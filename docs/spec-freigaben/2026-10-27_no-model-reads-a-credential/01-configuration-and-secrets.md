## 7. Configuration and secrets

**CONFIGURATION LIVES IN THE BROWSER** *(PO A. Maier)*
Endpoint, model, model API key, the repository tokens, the list of products, the bridge's address and
token, and the mailbox connection are stored in the browser of the person using the site; Agent M has
no other store for them.
*Check:* `tests/test_config_client_side.py`

**SETTINGS ARE EXPORTED AND IMPORTED WITH THEIR SECRETS** *(PO A. Maier)*
The dashboard exports all its browser settings — tokens, keys and passwords included — as one file, and
imports them from such a file.
*Check:* `tests/review-core.test.mjs` — an import of an export restores every setting, secrets included;
counter-proof: no export is ever committed or sent anywhere by the dashboard.

**AN EXPORT CAN BE LOCKED WITH A PASSPHRASE** *(PO A. Maier)*
The person may protect an export with a passphrase of their choice; the file is then encrypted in the
browser with a key derived from that passphrase and can be imported only with it.
*Check:* `tests/review-core.test.mjs` — a locked export contains no stored secret in clear and imports
with the passphrase; counter-proof: a wrong passphrase imports nothing.

**AN EXPORT STATES THAT IT CONTAINS SECRETS** *(PO A. Maier)*
Before an export is saved, the dashboard states that the file contains every token, key and password it
holds, and what each of them grants.
*Check:* `tests/test_settings_disclosure.py`

**EVERY SETTING IS REACHED FROM ONE PAGE** *(PO A. Maier)*
Every setting Agent M uses — kept in this browser, in the instance repository or in a product's
repository — is reached from one settings page.
*Check:* `tests/test_settings_page.py` — every key the dashboard writes to `localStorage` appears on the
page; counter-proof: a fixture key without a place on the page fails.

**A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN** *(PO A. Maier)*
Each setting kept in the browser is shown with a test of whether it still works and a control that
clears it.
*Check:* `tests/test_settings_page.py`

**A STORED SECRET IS HIDDEN UNTIL SHOWN** *(PO A. Maier)*
A stored token, key or password is displayed in a password field with a *Show* control that reveals it
in full.
*Check:* `tests/test_settings_page.py` — a stored secret is rendered hidden; counter-proof: after *Show*
it appears in full.

**A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE** *(PO A. Maier)*
For each stored token, the settings page shows the expiry date recorded when it was stored, and the
dashboard warns from fourteen days before it.
*Check:* `tests/test_settings_page.py`

**AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED** *(PO A. Maier)*
When a server refuses a stored token, the dashboard names that token and links the page on which it is
renewed with the same permissions and repositories.
*Check:* `tests/review-core.test.mjs` — a refused request yields the token's name and the renewal link.

**A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN** *(PO A. Maier)*
When a repository server refuses a request because a rate limit is used up, the dashboard names that
limit — the account's with a token, or the network's without one — and the time it resets where the
server tells the page, and never reports the token as refused or lacking a permission.
*Check:* `tests/review-core.test.mjs` — a `403` with `X-RateLimit-Remaining: 0` and `X-RateLimit-Limit:
5000` yields the account's limit and its reset time, and no token message; counter-proof: a `403` without
those headers is still reported as a missing permission.

**A PAGE LOAD READS THE REPOSITORY IN BATCHES** *(PO A. Maier)*
With a token on GitHub, one load of a dashboard page reads its commit and that commit's tree once, and the texts of
the files it shows in requests of at most 100 files each; a file whose blob the page has read already is not read
again, and an acceptance reads the head it commits on once.
*Check:* `tests/load-per-view.test.mjs` — over a counting fake GitHub that serves the batch request, the start page,
`#arc`, `#spec` and `#backlog` each send their commit and tree once and one batch for every hundred files they show,
and an acceptance of three files reads its head once; counter-proof: a load that reads each file by itself exceeds
that count.

**A PRODUCT'S SETTINGS LIVE IN ITS REPOSITORY** *(PO A. Maier)*
Settings that govern how a product is developed — its process model, Definition of Done, test
schedule, pseudonymisation and collaborators — are kept in files of the product's repository, never only
in a browser.
*Check:* `tests/test_settings_page.py` — changing a product setting on the page commits to the product
repository; counter-proof: `localStorage` holds no product setting.

**CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE** *(PO A. Maier)*
Configuration is written to `localStorage`; Agent M sets no cookie carrying configuration or
credentials.
*Check:* `tests/test_no_config_cookie.py`

**A CREDENTIAL IS NEVER PLACED IN A URL** *(PO A. Maier)*
No key, token or credential appears in a query string, a fragment, or a link.
*Check:* `tests/test_no_credential_in_url.py`

**A TOKEN IS SCOPED TO WHAT IT WRITES** *(PO A. Maier)*
Every repository token Agent M asks for carries write access only to the repositories of the
instance and the products it manages.
*Check:* `tests/test_token_scope_documented.py` — the configuration screen states the minimum
scope and why each part is needed.

**THE PAGE NAMES WHERE IT SENDS** *(PO A. Maier)*
Before Agent M sends anything, it names every destination it will contact — a participant with the place where that
participant processes data.
*Check:* `tests/site-frame-run-panel.test.mjs` and `tests/prompt-bar.test.mjs` — before a run and before a message of a conversation is sent, the page
names each destination, a participant with its processing place; counter-proof: a participant shown without its place
fails.

**A CLEAR IS A REAL CLEAR** *(PO A. Maier)*
Clearing the configuration removes the stored credentials from the browser, not only from the
displayed form.
*Check:* `tests/test_clear_removes_storage.py`

**THE GITHUB TOKEN IS PASTED, NOT OBTAINED BY LOGIN** *(PO A. Maier)*
Agent M uses a fine-grained personal access token that the person creates on github.com and pastes
into Agent M's settings.
*Check:* no automatic check; at review.

**A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT** *(PO A. Maier)*
Each repository token leaves the browser only as the authorisation header of requests to the API of
the server that issued it.
*Check:* `tests/review-core.test.mjs`

**NO MODEL READS A CREDENTIAL** *(PO A. Maier)*
No token, key or password that Agent M, its Bridge or its CI holds reaches a model: neither in what is sent to it nor
through a tool it calls, whether that tool reads files, the environment or the processes of the machine it works on.
*Check:* `tests/checkout-tools-credentials.test.mjs` — in a fixture checkout whose driver holds an endpoint key and whose
`.git/config` would hold a token, every tool's attempt to read either answers without it; counter-proof: the driver's
request to its own endpoint still carries the key.

**THE SHARED PAGES ORIGIN IS DISCLOSED** *(PO A. Maier)*
The settings page states, before a token or key is stored, that every GitHub Pages site under the
same `<owner>.github.io` domain can read what Agent M stores in the browser.
*Check:* `tests/test_settings_disclosure.py`

**THE TOKEN LINK IS PREFILLED** *(PO A. Maier)*
Agent M links to GitHub's page for new fine-grained tokens with name, description, expiry and the
required permissions already filled in.
*Check:* `tests/test_token_scope_documented.py`

**THE REPOSITORY CHOICE IS SPELLED OUT** *(PO A. Maier)*
Agent M tells the person to choose *Only select repositories* on GitHub's token page and names each
repository to select.
*Check:* `tests/test_token_scope_documented.py`

**A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN** *(PO A. Maier)*
For a product on a GitLab server, Agent M guides the person to create a project access token for
that one project, with role *Maintainer* and scope `api`, and to paste it into Agent M.
*Check:* `tests/review-core.test.mjs`

**ONE GITHUB TOKEN SERVES EVERY FEATURE** *(PO A. Maier)*
On GitHub, each token Agent M asks a person for — the instance's and each product's — is one fine-grained token that
carries every permission its features need on its repositories — *Contents*, *Issues* and *Pull requests* read and write,
*Actions*, *Workflows* and *Secrets* read and write, *Metadata* read.
*Check:* `tests/test_token_scope_documented.py` — the prefilled link asks for exactly these
permissions; `tests/dashboard-review-flows.test.mjs` — so does the link for a product's token.

**A GITHUB PRODUCT USES A TOKEN OF ITS OWN** *(PO A. Maier)*
For a product on GitHub, Agent M guides the person to create a fine-grained token whose only repository is the product's,
and to paste it into Agent M.
*Check:* `tests/dashboard-review-flows.test.mjs` — Step A of *+ Add product* names the product repository as the only one to
select, and after *Store and check* the product is read with that token while the instance's token is unchanged;
counter-proof: a Step A that also names the instance fails.

**A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT** *(PO A. Maier)*
The token page Agent M opens for a product on GitHub is prefilled with a name and a description built from the product
repository's name.
*Check:* `tests/dashboard-review-flows.test.mjs` — the link of Step A carries the product repository's name in the token's
name and description, within GitHub's limits of 40 and 1024 characters; counter-proof: the instance's name and description
fail.

**THE JUMP HOST AND THE REMOTE SESSIONS ARE SETTINGS** *(PO A. Maier)*
The jump host's name, SSH user, port range, HTTPS address and web-server login, and for each remote
session its name, port and bridge token, are kept in the browser's settings.
*Check:* `tests/test_settings_page.py`

**A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET** *(PO A. Maier)*
A job on the server's own machines pushes, opens pull requests and merges them with the person's Agent M
token stored as a CI secret of the product repository, never with the workflow's built-in token. The token is read
only on a runner machine on which no agent works; the agent's work reaches that machine as the run's result, which is
refused when it changes the repository's workflow files or holds a key of the run, and which is deleted from the
server once it is written.
*Check:* `tests/test_runtime_levels.py` — the generated job workflow authenticates its pushes and pull
requests with the named secret, on a runner machine that runs no agent; counter-proof: a workflow that uses
`GITHUB_TOKEN` for them, or that hands the secret to the machine the agent works on, fails.
