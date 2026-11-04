// The route `add-product` — Add a product (UC-001), as docs/architecture/MOD-settings-pages.md states it (Interfaces:
// view, strategy `add-product`). The address typed is recognised as GitHub or a GitLab server (MOD-repository-hosts'
// parseAddress). Step A gives the product a key of its own: on GitHub, the prefilled token page named and described
// after the product (A GITHUB PRODUCT USES A TOKEN OF ITS OWN, A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT), the
// repository to pick spelled out (THE REPOSITORY CHOICE IS SPELLED OUT), pasted and stored with the automatic check
// UC-001 step 3-4 describes; on a GitLab server, Step A only opens the project's own Access tokens page (A GITLAB
// PRODUCT USES A PROJECT ACCESS TOKEN, UC-001 3c), with the guidance for a project that offers none or an author who
// is not Maintainer (3d), and Step B — "Give the key to Agent M" there, not "Check" — pastes and stores the project's
// token with its own check.
//
// Step A on GitHub is shown done only once an actual check proves a key already reaches the product with write
// access — its own key, or, while the product has none, the instance's (3a); never merely because some token is
// stored (the gate of pull request #150: a stored instance token is not a check — products.mjs there counted it as
// reaching every GitHub product without reading any of them). A public repository's successful read never marks Step
// A done either way: UC-001 step 4 defers that confirmation to Step C's first write. Step B (Check) reads the
// product and names a missing repository with the server's page for a new one (2a), or any other refusal (4a). Step
// C, one click (ONE CLICK PER DECISION): MOD-artifact-edits' reviewLayoutCommit writes the parts the product's
// default branch lacks, nothing when it is complete (5b); the address is added to this browser's list, never to the
// instance repository (NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY). A write refused after a successful read (5a)
// is named, nothing is written, and Step A on GitHub is repainted with its instructions — a "done" shown earlier
// never survives a refusal at Check or at Add product.
//
// Each step that asks something of the person carries its folded "What is this?", from MOD-site-frame's
// explanations.md (EVERY STEP EXPLAINS ITSELF; ITM-255's topics for this view: repository, product-key,
// review-layout-commit, reverting-the-commit, the-product-list — none for Step B, which explanations.md does not
// hold a topic for either); Steps A and C state where the key and the commit go (THE PAGE STATES WHAT IT SENDS
// WHERE).
//
// Module: MOD-settings-pages
//
// Not part of this item: the routes `settings`, `get-your-own`/`setup`, `endpoints`, `participants`, `library`,
// `resources`, `mailbox` and `bridge` of this module (its other strategies), and how the dashboard reaches this
// route — a change between jobs after this item, per the item's Outcome.

import { parseAddress, connect } from "../repository-hosts/index.mjs";
import { reviewLayoutCommit } from "../artifact-edits/index.mjs";
import { readSetting, secretValues, writeSetting } from "../browser-store/index.mjs";
import { explain, tokenKeyOf } from "../site-frame/index.mjs";
import { heads } from "./routes.mjs";

export const TOKEN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_MAX = 40;
const INSTANCE_TOKEN_KEY = "github-token";
const PRODUCTS_KEY = "products";

// ---------------------------------------------------------------- small helpers (the module runs in a browser, where
// `document` is global; elements are built with createElement/append, never parsed from an HTML string, as
// src/implementation-pages/process.mjs's own `el` already does for another view of this frame).

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function anchor(text, href) {
  const a = el("a", null, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

const today = () => new Date().toISOString().slice(0, 10);
export const defaultExpiry = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + TOKEN_DAYS * DAY_MS).toISOString().slice(0, 10);

// A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT: name and description of a GitHub product's own token, from its
// repository's path, within GitHub's 40 characters for the name (a longer one drops the owner, then the end of the
// repository's name).
export function productTokenName(path) {
  const full = `Agent M · ${path}`;
  if (full.length <= NAME_MAX) return full;
  const short = `Agent M · ${path.split("/").pop()}`;
  return short.length <= NAME_MAX ? short : short.slice(0, NAME_MAX);
}

export const productTokenDescription = (path) =>
  `Agent M for the product ${path}: reviews, commits, issues, pull requests and runs of the work you start in it.`;

// THE REPOSITORY CHOICE IS SPELLED OUT: what to do on GitHub's prefilled token page.
export const repositoryChoiceSteps = (path) => [
  `Under "Repository access" choose "Only select repositories" — GitHub preselects "All repositories", which would ` +
    "give Agent M write access to everything you own.",
  `Open "Select repositories" and pick "${path}" — nothing else.`,
  `Press "Generate token" and copy the token GitHub now shows — it starts with github_pat_ and is shown only once.`,
];

// A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN (UC-001 3c): the steps on the project's own Access tokens page.
export const gitlabTokenSteps = (path, host) => [
  `The button opens Settings → Access tokens of ${path} on ${host}; there, press "Add new token".`,
  "Token name: Agent M.",
  `Expiration date: a date of your choice — ${TOKEN_DAYS} days from today is a good default. Enter the same date below.`,
  "Select a role: Maintainer — GitLab lets only Maintainers push to a protected default branch. Select scope: api — " +
    "nothing else.",
  'Press "Create project access token" and copy the token GitLab now shows — it starts with glpat- and is shown only ' +
    "once.",
];

// UC-001 3d: both causes are reported by the author from GitLab's external page. repositoryInfo exposes canWrite,
// not project-token availability, so neither cause is inferred or retained beyond this unsaved add-product screen.
const GITLAB_ALTERNATIVE_REASONS = [
  { id: "no-project-tokens", label: "this server offers no project access tokens",
    action: "This server's administrator or a Maintainer can enable or create a project access token." },
  { id: "not-maintainer", label: "I am not Maintainer",
    action: "Ask a Maintainer to create the project access token or to give you the Maintainer role." },
];

export const gitlabNoProjectTokens = (host, reason) =>
  `${reason.action} A personal access token with api scope reaches every project you can reach on ${host}, not only ` +
  "this project. You decide whether to use that broader token or seek project access; Agent M does not choose, generate " +
  "or substitute a personal token.";

// The key MOD-browser-store keeps a product's own token under (A GITHUB PRODUCT USES A TOKEN OF ITS OWN, A GITLAB
// PRODUCT USES A PROJECT ACCESS TOKEN; MOD-browser-store, Data), computed by MOD-site-frame's tokenKeyOf.
export const tokenSettingKey = (address) => tokenKeyOf(address);

// The repository a token's key is for, the step back from tokenSettingKey: `github-token` is the instance's, `github-token:<owner>/<repository>`
// a GitHub product's, `gitlab-token:<server>/<project>` a GitLab project's. null for a key that is no token's, or that names no readable repository.
export function tokenKeyAddress(key, instanceRepository) {
  try {
    if (key === INSTANCE_TOKEN_KEY) return parseAddress(`https://github.com/${instanceRepository}`);
    if (key.startsWith("github-token:")) return parseAddress(`https://github.com/${key.slice("github-token:".length)}`);
    if (key.startsWith("gitlab-token:")) return parseAddress(`https://${key.slice("gitlab-token:".length)}`);
  } catch { /* no readable repository */ }
  return null;
}

// The refusal of a token pasted for a setting (MOD-settings-pages, *A pasted token*): the token is connected, with the options the frame's own connection
// passes, to the repository its key names before anything is stored. -> the line that names the setting — `connect`'s message never holds the token —
// or null when `connect` accepts it, or when the key names no readable repository (`address` null), which has no host to refuse it.
export function tokenRefusal(store, address, key, value, tokenName) {
  if (!address) return null;
  try { connect(address, { token: value, tokenName, secrets: secretValues(store) }); return null; }
  catch (error) { return `the token under ${key} is refused. ${error.message}`; }
}

function storedToken(store, key) {
  const t = readSetting(store, key);
  return t ? { token: t.value, tokenName: t.name, expires: t.expires ?? null } : null;
}

// The credentials Steps B and C read a product with: its own stored token if this browser has one; for a GitHub
// product only, else the instance's token while the product has none of its own (UC-001 3a/3b) — a GitLab product's
// token is never the instance's, which is a GitHub token ("Each GitLab product has its own token; the instance's
// GitHub token is not involved there."). null when this browser holds no usable key yet.
export function credentialsFor(store, address) {
  const own = storedToken(store, tokenSettingKey(address));
  if (own) return own;
  return address.server === "github" ? storedToken(store, INSTANCE_TOKEN_KEY) : null;
}

// NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY: the product's address goes only into this browser's own list.
export function rememberProduct(store, web) {
  const existing = readSetting(store, PRODUCTS_KEY) ?? [];
  if (!existing.includes(web)) writeSetting(store, PRODUCTS_KEY, [...existing, web]);
}

// repositoryInfo(), told apart from a missing repository (2a) and any other refusal (4a). -> { ok: true, info, host }
// | { ok: false, error, host }. `host` is always handed back: a 2a notice links its webLinks().newRepository even on
// a refusal.
export async function checkProduct(address, credentials) {
  const host = connect(address, credentials ?? {});
  try {
    return { ok: true, info: await host.repositoryInfo(), host };
  } catch (error) {
    return { ok: false, error, host };
  }
}

// UC-001 step 4: a public repository's successful read proves nothing about write access — any key reads a public
// repository — so write access there is confirmed only by Step C's first write. Only a private repository, read
// with a key the server reports able to write, proves that the key reaches the product: that alone is shown as Step
// A done (3a).
export const provesReach = (result) => Boolean(result.ok && result.info.visibility === "private" && result.info.canWrite);

function missingRepositoryNotice(web, host) {
  const p = el("p", "result", `✗ ${web} was not found — it may not exist yet, or be private to a key that does not ` +
    "reach it yet. ");
  p.append(anchor("Create it on the server's page for a new repository ↗", host.webLinks().newRepository ?? "#"),
    ", then press Check again.", explain("new-repository"));
  return p;
}

function checkResultNotice(web, result) {
  if (result.ok) {
    return el("p", "result", `✓ ${web} is reachable` +
      (provesReach(result) ? " — this key can write here." : " — write access is confirmed only by the first write."));
  }
  if (result.error?.name === "NotFound") return missingRepositoryNotice(web, result.host);
  return el("p", "result", `✗ ${result.error?.message ?? result.error}`);
}

function stepSection(title, ...body) {
  return el("section", "step", el("h3", null, title), ...body);
}

function placeholderSteps(message) {
  const addBtn = el("button", "add btn primary", "Add product");
  addBtn.disabled = true;
  return [
    stepSection("Step A · A key for the product",
      el("p", "muted", "Paste the product repository's address above — Step A then opens the server's token page " +
        "for it.")),
    stepSection("Step B · Check", el("p", "muted", "—")),
    stepSection("Step C · Add the product", el("p", null, addBtn), el("p", "result", message)),
  ];
}

// THE SHARED PAGES ORIGIN IS DISCLOSED: settings live in the origin of this dashboard, whose owner is the
// instance repository's owner. It is deliberately not derived from a product address: a GitLab product has no
// bearing on which GitHub Pages sites share this browser storage.
export function sharedPagesNotice(context) {
  const owner = String(context.instance?.repository ?? "").split("/")[0];
  return `Everything Agent M stores in this browser is stored for the address https://${owner}.github.io — every GitHub Pages site under that same ${owner}.github.io domain can read it.`;
}

function acknowledgementControls(token, expires, storeBtn) {
  token.disabled = true;
  expires.disabled = true;
  storeBtn.disabled = true;
  const ack = el("input", "ack");
  ack.type = "checkbox";
  ack.checked = false;
  ack.addEventListener("change", () => {
    token.disabled = expires.disabled = storeBtn.disabled = !ack.checked;
    if (ack.checked) token.focus();
  });
  return ack;
}

// ---------------------------------------------------------------- Step A (GitHub): the prefilled token page, the
// repository to pick, paste + expiry + Store and check. The check it runs is shown in Step B's own output (`out`,
// passed in), "without another click" (UC-001 step 4); `afterCheck` repaints Step A and Step C from its result.

function githubStepABody(context, address, out, afterCheck) {
  const page = connect(address, {}).webLinks()
    .newToken(productTokenName(address.path), productTokenDescription(address.path), TOKEN_DAYS);
  const token = el("input", "token");
  token.value = ""; token.type = "password"; token.placeholder = "github_pat_…"; token.autocomplete = "off"; token.spellcheck = false;
  const expires = el("input", "expires");
  expires.type = "date"; expires.value = defaultExpiry();
  const storeBtn = el("button", "store btn primary", "Store and check");
  const ack = acknowledgementControls(token, expires, storeBtn);
  const err = el("p", "result");
  storeBtn.addEventListener("click", async () => {
    if (!ack.checked) return;
    const value = token.value.trim(), expiresOn = expires.value;
    if (!value || !expiresOn) { err.textContent = "Paste the token and its expiry date first."; return; }
    const tokenName = productTokenName(address.path);
    const refused = tokenRefusal(context.store, address, tokenSettingKey(address), value, tokenName);
    if (refused) { err.textContent = `Nothing was stored: ${refused}`; return; }
    writeSetting(context.store, tokenSettingKey(address), { value, name: tokenName, expires: expiresOn, stored: today() });
    context.tokenStored?.();
    err.textContent = "";
    out.replaceChildren();
    out.textContent = `Reading ${address.web}…`;
    const result = await checkProduct(address, { token: value, tokenName, secrets: secretValues(context.store) });
    out.replaceChildren();
    out.append(checkResultNotice(address.web, result));
    afterCheck(result);
  });
  return [
    el("p", null, anchor("Open GitHub's token page (prefilled) ↗", page)),
    el("ol", "choices", ...repositoryChoiceSteps(address.path).map((s) => el("li", null, s))),
    el("p", "muted", "The key is sent only to GitHub's API, for this product alone — never to the model endpoint."),
    el("p", "notice", sharedPagesNotice(context)),
    el("p", null, el("label", null, ack, " I have read this.")),
    el("p", null, "Token ", token, " expires on ", expires, " ", storeBtn),
    err,
    explain("product-key"),
  ];
}

function doneStepABody(web) {
  return [
    el("p", "result", `✓ Your key already reaches ${web} — nothing to do on GitHub.`),
    explain("product-key"),
  ];
}

// ---------------------------------------------------------------- Step A (GitLab): instructions only — Step B pastes
// and stores the project's own token (UC-001 3c). No "done" variant: unlike GitHub's instance-token fallback,
// nothing here is implied by storage alone, and UC-001 names no such state for a GitLab product's Step A.

function gitlabStepABody(address, selectedReason, selectReason) {
  const host = new URL(address.origin).host;
  const page = connect(address, {}).webLinks().projectTokens ?? "#";
  const alternatives = GITLAB_ALTERNATIVE_REASONS.map((reason) => {
    const selected = selectedReason === reason.id;
    const detail = el("details", "gitlab-alternative");
    const select = el("button", "gitlab-alternative-select btn", `I saw: ${reason.label}`);
    if (selected) detail.setAttribute("open", "");
    detail.append(
      el("summary", null, reason.label),
      el("p", "result", selected ? `Selected: ${reason.label}.` :
        "If the page offers no project access tokens, or you are not Maintainer, select the cause it shows."),
      el("p", null, gitlabNoProjectTokens(host, reason)),
      el("p", null, select),
    );
    select.addEventListener("click", () => selectReason(reason.id));
    return detail;
  });
  return [
    el("p", null, anchor(`Open Access tokens on ${host} ↗`, page)),
    el("ol", "choices", ...gitlabTokenSteps(address.path, host).map((s) => el("li", null, s))),
    el("p", null, "If the external page prevents the normal project-token route, expand and select the reason it shows:"),
    ...alternatives,
    explain("product-key"),
  ];
}

// Step B (GitLab): "Give the key to Agent M" — a token already stored offers a plain Check beside pasting a new one
// (UC-001 3a's "its own" key, without pasting again); Store and check runs the same check as GitHub's Step A.
function gitlabStepBBody(context, address, afterCheck) {
  const host = new URL(address.origin).host;
  const key = tokenSettingKey(address);
  const already = storedToken(context.store, key);
  const token = el("input", "token");
  token.value = ""; token.type = "password"; token.placeholder = "glpat-…"; token.autocomplete = "off"; token.spellcheck = false;
  const expires = el("input", "expires");
  expires.type = "date"; expires.value = defaultExpiry();
  const storeBtn = el("button", "store btn primary", "Store and check");
  const ack = acknowledgementControls(token, expires, storeBtn);
  const out = el("p", "result");
  const children = [];
  if (already) {
    const checkBtn = el("button", "check btn", "Check");
    checkBtn.addEventListener("click", async () => {
      out.replaceChildren();
      out.textContent = `Reading ${address.web}…`;
      const result = await checkProduct(address, { token: already.token, tokenName: already.tokenName, secrets: secretValues(context.store) });
      out.replaceChildren();
      out.append(checkResultNotice(address.web, result));
      afterCheck(result);
    });
    children.push(el("p", "result", `✓ A token for this project is already stored in this browser` +
      (already.expires ? ` (expires on ${already.expires})` : "") + ". ", checkBtn, " — or paste a new one below."));
  }
  storeBtn.addEventListener("click", async () => {
    if (!ack.checked) return;
    const value = token.value.trim(), expiresOn = expires.value;
    if (!value || !expiresOn) { out.textContent = "Paste the token and its expiry date first."; return; }
    const tokenName = "Agent M";
    const refused = tokenRefusal(context.store, address, key, value, tokenName);
    if (refused) { out.textContent = `Nothing was stored: ${refused}`; return; }
    writeSetting(context.store, key, { value, name: tokenName, expires: expiresOn, stored: today() });
    context.tokenStored?.();
    out.replaceChildren();
    out.textContent = `Reading ${address.web}…`;
    const result = await checkProduct(address, { token: value, tokenName, secrets: secretValues(context.store) });
    out.replaceChildren();
    out.append(checkResultNotice(address.web, result));
    afterCheck(result);
  });
  children.push(
    el("p", "muted", `The key is sent only to this project's own API on ${host} — never to GitHub or the model ` +
      "endpoint."),
    el("p", "notice", sharedPagesNotice(context)),
    el("p", null, el("label", null, ack, " I have read this.")),
    el("p", null, "Token ", token, " expires on ", expires, " ", storeBtn),
    out,
    explain("product-key"),
  );
  return children;
}

// ---------------------------------------------------------------- Step C: one click (ONE CLICK PER DECISION).

function stepCSection(context, address, onWriteRefused) {
  const label = address.server === "gitlab" ? "Step B" : "Step A";
  const btn = el("button", "add btn primary", "Add product");
  const out = el("p", "result");
  const sends = el("p", "muted", `One click writes the missing review layout into ${address.web}'s own default ` +
    "branch and adds its address to this browser's product list — nothing is written to the instance repository.");

  function refresh() {
    const credentials = credentialsFor(context.store, address);
    btn.disabled = !credentials;
    out.textContent = credentials ? "" : `Store the product's key in ${label} first.`;
  }
  refresh();

  btn.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    const credentials = credentialsFor(context.store, address) ?? {};
    btn.disabled = true;
    out.replaceChildren();
    out.textContent = `Reading ${address.web} and writing what is missing…`;
    const host = connect(address, { ...credentials, secrets: secretValues(context.store) });
    try {
      const layout = await reviewLayoutCommit(host);
      rememberProduct(context.store, address.web);
      out.replaceChildren();
      if (layout.complete) {
        out.textContent = `Nothing was missing in ${address.web}; it is now in this browser's product list.`;
      } else {
        out.append("Done — wrote the missing review layout in ", anchor("the commit ↗", layout.commit.url),
          `; ${address.web} is now in this browser's product list.`);
      }
      const switchProduct = el("button", "switch btn", "Switch to the new product");
      switchProduct.addEventListener("click", () => context.go("main", { product: address.web }));
      out.append(" ", switchProduct);
    } catch (e) {
      out.replaceChildren();
      if (e?.name === "NotFound") {
        out.append(missingRepositoryNotice(address.web, host));
      } else if (e?.name === "PermissionMissing") {
        out.textContent = `Your key cannot write to ${address.web} yet (${e.message}). Store a key that reaches it ` +
          `in ${label}, then try again.`;
        onWriteRefused(); // 5a: a "done" shown earlier never survives a refused write
      } else {
        out.textContent = `✗ ${e.message} — nothing was written.`;
      }
      btn.disabled = false;
    }
  });

  const section = stepSection("Step C · Add the product", el("p", null, btn), out, sends,
    explain("review-layout-commit"), explain("reverting-the-commit"), explain("the-product-list"));
  return { section, refresh };
}

// ---------------------------------------------------------------- putting the steps together

function renderSteps(container, context, text) {
  container.replaceChildren();
  const trimmed = text.trim();
  if (!trimmed) { container.append(...placeholderSteps("Paste the product repository's address above.")); return; }
  let address;
  try {
    address = parseAddress(text);
  } catch (e) {
    container.append(...placeholderSteps(e.message));
    return;
  }

  const gitlab = address.server === "gitlab";
  const state = { done: false, gitlabAlternative: null };
  const stepAEl = el("section", "step");
  const stepBOut = el("p", "result"); // GitHub's Step B output only; GitLab's Step B has its own.
  const stepC = stepCSection(context, address, () => { state.done = false; paintStepA(); });

  function paintStepA() {
    stepAEl.replaceChildren();
    if (gitlab) {
      stepAEl.append(el("h3", null, "Step A · Create a key for this project"),
        ...gitlabStepABody(address, state.gitlabAlternative, (reason) => { state.gitlabAlternative = reason; paintStepA(); }));
    } else if (state.done) {
      stepAEl.append(el("h3", null, "Step A · A key for the product — done"), ...doneStepABody(address.web));
    } else {
      stepAEl.append(el("h3", null, "Step A · A key for the product"), ...githubStepABody(context, address, stepBOut, afterCheck));
    }
  }

  function afterCheck(result) {
    state.done = provesReach(result) && !gitlab;
    paintStepA();
    stepC.refresh();
  }

  paintStepA();

  let stepBEl;
  if (gitlab) {
    stepBEl = el("section", "step", el("h3", null, "Step B · Give the key to Agent M"),
      ...gitlabStepBBody(context, address, afterCheck));
  } else {
    const checkBtn = el("button", "check btn", "Check");
    checkBtn.addEventListener("click", async () => {
      stepBOut.replaceChildren();
      stepBOut.textContent = `Reading ${address.web}…`;
      const credentials = credentialsFor(context.store, address);
      const result = await checkProduct(address, { ...credentials, secrets: secretValues(context.store) });
      stepBOut.replaceChildren();
      stepBOut.append(checkResultNotice(address.web, result));
      afterCheck(result);
    });
    stepBEl = stepSection("Step B · Check", el("p", null, checkBtn), stepBOut, explain("product-key"));
  }

  container.append(stepAEl, stepBEl, stepC.section);
}

export const route = {
  ...heads.addProduct,
  // params: unused — add-product takes none (the route's own fragment is just "add-product"); kept for the Route's
  // contract, render(target, context, params).
  async render(target, context, params) {
    target.replaceChildren();
    const addressInput = el("input", "address");
    addressInput.value = ""; addressInput.placeholder = "https://github.com/owner/name"; addressInput.autocomplete = "off";
    addressInput.spellcheck = false;
    const stepsContainer = el("div", "steps");
    target.append(
      el("section", "head", el("h2", null, "Add a product")),
      el("p", "muted", "The product gets a key of its own — on GitHub a fine-grained token for it alone, on a " +
        "GitLab server a project access token, sent only to that server's own API. Your instance's key stays as it " +
        "is."),
      el("label", null, "Product repository address ", addressInput),
      explain("repository"),
      stepsContainer,
    );
    const update = () => renderSteps(stepsContainer, context, addressInput.value);
    addressInput.addEventListener("input", update);
    update();
    // A FORM OPENS WITH ITS FIRST FIELD FOCUSED.
    addressInput.focus();
  },
};
