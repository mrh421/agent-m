---
id: MOD-settings-pages
title: The pages of settings
folder: src/settings-pages/
realises:
follows:
  - ARC-038
uses:
  - MOD-site-frame.View
  - MOD-site-frame.chosenProduct
  - MOD-site-frame.instanceOf
  - MOD-site-frame.explain
  - MOD-site-frame.notice
  - MOD-site-frame.runPanel
  - MOD-site-frame.confirmDecision
  - MOD-site-frame.schemaForm
  - MOD-markdown-render.renderArtifact
  - MOD-browser-store.openStore
  - MOD-browser-store.readSetting
  - MOD-browser-store.writeSetting
  - MOD-browser-store.clearSetting
  - MOD-browser-store.clearEverything
  - MOD-browser-store.listSettings
  - MOD-browser-store.exportSettings
  - MOD-browser-store.importSettings
  - MOD-browser-store.readExport
  - MOD-browser-store.expiringSoon
  - MOD-browser-store.secretValues
  - MOD-repository-hosts.parseAddress
  - MOD-repository-hosts.connect
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-repository-hosts.commitFiles
  - MOD-repository-hosts.startWorkflow
  - MOD-repository-hosts.setCiSecret
  - MOD-repository-hosts.ciVariableScopes
  - MOD-repository-hosts.listReleaseAssets
  - MOD-repository-hosts.webLinks
  - MOD-identifiers.pagesAddress
  - MOD-bridge-client.settingsOf
  - MOD-bridge-client.bridgeAt
  - MOD-bridge-client.pair
  - MOD-bridge-client.testBridge
  - MOD-bridge-client.probe
  - MOD-bridge-client.allocatePort
  - MOD-bridge-client.tunnelCommands
  - MOD-bridge-client.proxyConfiguration
  - MOD-endpoint-calls.testEndpoint
  - MOD-endpoint-calls.diagnoseEndpoint
  - MOD-endpoint-calls.modelContext
  - MOD-mail-routes.routeFor
  - MOD-mail-routes.signIn
  - MOD-mail-routes.mailbox
  - MOD-mail-routes.providerLinks
  - MOD-documents.readDocument
  - MOD-documents.readRegister
  - MOD-documents.writeDocument
  - MOD-artifact-edits.saveFile
  - MOD-artifact-edits.reviewLayoutCommit
  - MOD-participant-list.participantSchema
  - MOD-participant-list.participantsOf
  - MOD-participant-list.reachedThrough
  - MOD-product-process.declarationSchema
  - MOD-product-process.productWorkflow
  - MOD-product-process.roleAssignmentSchema
  - MOD-product-process.roleAssignmentFindings
  - MOD-source-register.sourceSchemas
  - MOD-source-register.registrationCommits
  - MOD-source-register.versionCommits
  - MOD-source-register.linkedVersion
  - MOD-source-register.affectedRequirements
  - MOD-source-register.changedPassages
  - MOD-source-register.recogniseLegalText
  - MOD-source-register.permittedPlaces
  - MOD-source-register.readContent
  - MOD-text-tools.sha256
  - MOD-text-tools.finding
  - MOD-resource-list.resourceSchema
  - MOD-resource-list.resourceFindings
  - MOD-resource-list.readPin
  - MOD-resource-list.checkPlan
  - MOD-resource-list.newerState
  - MOD-resource-list.namedBy
  - MOD-resource-list.resourceStrategies
  - MOD-reuse-facts.registryFacts
  - MOD-reuse-facts.hubFacts
  - MOD-reuse-facts.repositoryFacts
  - MOD-personal-data.settingsSchemas
  - MOD-personal-data.pseudonymisationOf
  - MOD-personal-data.namedPersonFindings
  - MOD-job-runner.prepareJob
  - MOD-job-ledger.newJobId
  - MOD-runtimes.routesFor
  - MOD-runtimes.queueJob
  - MOD-runtimes.jobWorkflowFiles
  - MOD-runtimes.gitlabVariableScopes
  - MOD-notifications.NotificationState
  - MOD-notifications.notificationState
  - MOD-notifications.switchOn
  - MOD-notifications.testNotification
  - MOD-notifications.switchOff
  - MOD-prompt-bar.recordingSchema
  - MOD-prompt-bar.recordingOf
  - MOD-prompt-bar.Subject
  - MOD-prompt-bar.endpointLacks
  - MOD-prompt-bar.endpointsOffered
  - MOD-prompt-bar.spawnEndpointJob
  - MOD-prompt-bar.followJob
provides:
  - view
---
# MOD-settings-pages The pages of settings

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is the menu entry Settings: every setting Agent M uses on one
page — what this browser keeps, what the instance repository keeps, what each product's repository keeps
(`EVERY SETTING IS REACHED FROM ONE PAGE`) — and the guided pages that first set them up: getting one's own Agent M and
finishing its setup, adding a product, model endpoints, participants, the source library and a product's links to it,
resources, the mailbox, and the Agent M Bridges with the jump host. Every register is edited in a
form built from its owner's schema; every notice a setting needs stands before the setting is stored.

It serves UC-001, UC-003, UC-004, UC-011, UC-014, UC-015, UC-016, UC-017, UC-037, UC-040, UC-042, UC-044 and UC-047.

It runs in a browser, loaded by `docs/index.html` through MOD-site-frame. The one job it starts is the check of a
resource on its runner, queued to that runner's route; for its run panel it hands the frame `resourceStrategies`.

## Parts

- `index.mjs` — the interface: `view`.
- `settings.mjs` — the one page of every setting, its tests, clears, export and import.
- `setup.mjs` — getting one's own Agent M and finishing its setup.
- `products.mjs` — adding a product.
- `endpoints.mjs`, `participants.mjs`, `library.mjs`, `resources.mjs`, `mailbox.mjs`, `bridge.mjs` — the guided pages.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `tests/test_settings_page.py`, `tests/test_token_scope_documented.py`, `tests/settings-pages-export-import.test.mjs`, `tests/settings-pages-settings-regressions.test.mjs`: their headers name this module.

## Data

It keeps nothing but the screen and an unsaved form. Its formats are those of the modules it uses.

## Interfaces

- `view: View` — its routes, and the strategies of `resourceStrategies`. Each route gives the prompt bar its subject
  (UC-049 3c): the page names each setting and whether it is stored, works or has expired, never a
  value, so that a secret shown on *Show* is never part of what a participant is given:
  - `settings` — three sections — this browser, the instance, each product —, one line per setting with its state:
    works, with the date of the last successful test; expires on, from fourteen days before a token's recorded expiry;
    refused; not set. A browser setting has *Test*, *Change* and *Clear*, a secret hidden until *Show*; each Bridge is a
    line of its own, under its name, and its *Clear* names first the endpoints, participants, mailbox and resources that
    name it (UC-042, 2a). The line
    *Notifications* of this browser's section (UC-047) shows the state `notificationState` gives: *off*, or switched on
    without this browser's permission yet, with *Switch on*, whose click asks the browser's permission; *on*, with how
    many files were notified, *Test* and *Switch off*, which is its clear; *blocked*, when the person or the browser
    refused, with where the browser's own site settings allow notifications for this site; on an iPhone or iPad not
    opened from the Home Screen, that Safari shows notifications only for a site added to the Home Screen, and how to add
    it; after *Switch off*, that the browser keeps its permission until the person takes it back in its settings. A
    repository setting has a summary and *Edit*, opening its form here or the page where it is kept — the product's
    process on the implementation pages, its schedule on the test pages. A product's section holds its pseudonymisation —
    switching it off states first what follows —, its collaborators who agreed to be named, and whether Agent M's job
    workflow is installed, with *Install*, which names among the job workflow's keys, beside the CI secrets of the
    participants' routes, the CI secret each of this browser's endpoints names. For a GitLab product the line names each
    CI/CD variable of the job workflow with the environment scopes it needs (MOD-runtimes' `gitlabVariableScopes`), checks
    them against the project's variables as its server lists them — names and scopes, never a value
    (MOD-repository-hosts' `ciVariableScopes`) —, and calls the job workflow safe only where every variable stands with
    exactly those scopes; it names each variable that lacks a scope or has another, and where the server does not list the
    variables, it says why and that the job workflow is not safe until the scopes are as named. The instance's section holds *Recording conversations* (UC-042 step 3),
    *off* unless switched on: switching it on states first that every message of a conversation in the prompt bar, the
    person's and the participant's, will be committed under `docs/conversations/` of the repository of the page it is
    held on and stay in its history, and names each of the instance's and the products' repositories that its server
    reports as public, whose conversations would be published (`SWITCHING CONVERSATION RECORDING ON STATES WHAT
    FOLLOWS`); the person ticks *I have read this* and saves, which commits the instance's
    `docs/conversation-recording.md`; switching it off is saved without a notice, and the page says that records already
    written stay in the history (UC-042 3b). At the bottom *Export settings*, after the statement of every secret it holds
    and what each grants, optionally locked with a passphrase; *Import settings*, which keeps what this browser has and
    adds the rest, listing both, and which stores nothing when the file holds a token of the other kind of server than its
    key names — a `github-token` or `github-token:<owner>/<repository>` token is connected to a GitHub repository, a
    `gitlab-token:<server>/<project>` token to that GitLab project, before the file is imported, and a refusal of
    `connect` refuses the import, with a line that names the key and never the token; *Clear everything in this browser*.
    Each section and line has its folded explanation,
    among them that every Pages site of the same owner can read this browser's store, and, for *Notifications*, what is
    checked and how often, that the checks go to the repository servers with this browser's tokens and nowhere else, and
    that nothing is checked while no page of the dashboard is open.
  - `get-your-own`, `setup` — the fork, Pages and Actions steps with their direct links once the owner is known; then
    *Finish setting up*: the prefilled token page with the folded *Why these?* of its permissions (UC-014 step 7),
    *Only select repositories* and the instance named, the shared-origin
    notice with its tick, the token and its expiry, *Store and check*, and *Import settings* beside it.
  - `add-product` — the address recognised as GitHub or GitLab; the token's step for that server with the names filled
    in, or the GitLab project access token; *Check*; *Add product*, which writes the missing review layout and adds the
    address to this browser's list; each step with its explanation.
  - `endpoints` — address, model and key of a model endpoint, the place where it processes data, the model's context in
    tokens and the name of the CI secret that holds its key, and, for one the browser cannot call, the Bridge that
    reaches it, chosen among the Bridges this browser keeps; the test request, directly or through that Bridge, with
    whether the model called the tool it was offered — *can use tools* or *text only* (UC-003 step 5, 5a) —; after a direct
    test that works, for an endpoint that declares no context, the context its endpoint states (MOD-endpoint-calls'
    `modelContext`), kept with it, or that it states none; and the
    reason and the routes that would work when a browser may not call it — said plainly, by the endpoint's host: `<host>
    does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge.`, the browser's own
    words only after it, in parentheses, on the form and on the endpoint's line of the Settings page. For such an endpoint whose key this browser
    keeps, it says what one click does and offers it: the key stored as the GitHub Actions secret the endpoint names —
    else its name in capitals followed by `_API_KEY` — of the chosen product's repository, else the instance's, with
    MOD-repository-hosts' `setCiSecret`; the secret's name kept with the endpoint, and the key kept in this browser;
    and one test job of the endpoint spawned there with MOD-prompt-bar's `spawnEndpointJob` (the kind `converse`, a
    one-line task) and followed with `followJob`, whose end and answer are the endpoint's test, recorded as its last
    test. An endpoint that names a CI secret and no Bridge runs through GitHub
    Actions: it is not called from the page, and its *Test* is that test job; a folded explanation that the prompt bar
    appears once an endpoint is configured or a Bridge offers a CLI session (UC-049 1a); *Clear*.
  - `participants` — the instance's participants in a form from the participant schema, a new one prefilled with the
    parameters `type` and `address` where the route is opened with them: type, model, context and price, capabilities,
    processing place, route; for a CLI or sandboxed agent, the Bridge it runs on, chosen among this browser's Bridges,
    the agents that Bridge offers, and *Test* through it — or, for a subagent, the CLI agent that starts it, which it is
    reached through (UC-017 step 3); for a model endpoint, *use tools* preset from its endpoint's last test, and the CI
    secret of its key where its jobs may run on the server's runners; for a self-hosted runner, the explanation that it
    serves private repositories only and is refused when a public product's job would run on it (`routesFor`); a change
    to a participant that products use, with those products and roles named.
  - `library`, `library/<source>`, `sources` — the instance's register of sources and a source's versions; *+ Register
    source* by route — EU legal text, standard, documents, repository — with the files hashed in the browser and what
    becomes public stated before *Save*, which commits the entry and its content where its licence allows — the instance,
    or the repository the person names; *+ New version*, refused when its bytes equal an existing version's, the
    products on older versions, *Move* with the requirements affected and the passages changed; *Fetch again* for a
    legal text whose fetch failed, and *+ New version* of a fetched one, each starting the fetch run for that entry
    (MOD-repository-hosts' `startWorkflow` with the input `source`); for the chosen product, the linked sources with version and part, and removing a link
    with the requirements that name the source listed first.
  - `resources`, `resources/instance` — a product's or the instance's resources in a form from the resource schema; the
    pin, licence and maintainer read where they can be; the route; the secret by name only; the processing place;
    *Check* through the Bridge the route names, or as a check job on its runner with its run panel; for a repository, the
    facts of MOD-reuse-facts' `repositoryFacts`; for a key kept in this browser (secret `browser`), its field, stored as
    `resource-key:<name>`; a newer state upstream with *Move*, and on *Move* and on *Remove* the jobs and tests that name
    the resource (MOD-resource-list's `namedBy`), listed and not changed; for an endpoint or agent that also works on the
    product, *Add as participant*, which opens `participants` with its parameters `type` and `address` filled in;
    *Copy from the instance*.
  - `mailbox` — the route recognised from the address; for Microsoft 365 the app registration's steps and the sign-in
    with its permissions named before the provider's window opens; for every other mailbox the servers and ports, the
    notice before the password field, and an app password explained; the Bridge the connection goes through, chosen
    among this browser's Bridges, and, for one reached through the jump host, the notice that the jump host can read the
    password and the mails, before saving; the folders; the processing places the mail may go to, a place outside the EU
    stated as not compliant before saving; *Store and test*; *Disconnect*. Each test of the mailbox — *Store and test*
    here, *Test* on its line of `settings` — is stored as its last test, `last-test:mailbox`, with the `sending` its
    `test()` gives (UC-037 7d).
  - `bridge` — the release's file for this computer's system with its size and the SHA-256 the server reports for it,
    or, where the server reports none, a link to the release's checksum file, and beside the file the publisher to look
    for, the name of the line `Publisher (<system>): <name>` that the release's notes hold for this system
    (MOD-bridge-build), which the folded *Why this warning?* repeats; where the notes hold no such line (Linux, or a
    release written without it), the page says that the release names no publisher for this system and writes none; the
    Bridges this browser keeps, each under its name: pairing one on this computer or at a forwarded address with the
    token its window shows, kept under the name it reports; *+ Bridge through the jump host*, named by the person, with
    its port from the range and the two tunnel commands for a computer without a Bridge; the jump host and its port
    range, HTTPS address and web-server login; the jump host's web-server configuration for every Bridge reached through
    it; *Test* of a Bridge at its address — for one reached through the jump host its HTTPS address —, a certificate the
    browser does not trust named as a possible cause; for each CLI session a Bridge offers (MOD-bridge-client's
    `testBridge`), the place where it processes data, its context in tokens, its model and its capabilities, prefilled
    as for a CLI agent (UC-017), kept under `session:<bridge>:<agent>`, and one lacking a place, a context or a model
    named as not offered in the prompt bar (UC-049 1b).
  - **A pasted token** — in *Store and check* of `setup` and of `add-product`, and in *Change* of `settings` — is connected
    with MOD-repository-hosts' `connect` to the repository it is for before it is stored: the instance for the key
    `github-token`, the product for its own key, and for *Change* the repository its setting's key names. A refusal of
    `connect`, a token of the other kind of server or a text that is a token of neither kind, stores nothing and shows a
    line that names the setting and never the token; in `setup` that line replaces the page's own refusal of a text that
    is no GitHub token, so that `setup` keeps no form of a token of its own and checks only the expiry date it asks for.
    The form of a token is `connect`'s alone, here as in the import; a setting whose key names no readable repository has
    no host to refuse it, and is stored as pasted.

## Files

It writes, on a person's click and as that person's commit: the instance's `docs/participants.md` and
`docs/resources.md` and `docs/conversation-recording.md`, and a product's `docs/sources.md`, `docs/resources.md`,
`docs/settings.md` and `docs/collaborators.md`, with `saveFile`; the source register's entries and content under `docs/sources/` of the instance,
and restricted content in the repository the person names, as the commit plans of MOD-source-register say; a product's
review layout when it is added; Agent M's job workflow files of a product; a resource's check job's start record through
MOD-runtimes. It writes this browser's settings through MOD-browser-store, the switch of the notifications through
MOD-notifications. It reads the instance's and the products' snapshots, the Bridge's releases, and what each test
reaches.

## Uses

- MOD-site-frame.View, MOD-site-frame.chosenProduct, MOD-site-frame.instanceOf, MOD-site-frame.explain,
  MOD-site-frame.notice, MOD-site-frame.runPanel, MOD-site-frame.confirmDecision, MOD-site-frame.schemaForm — the frame's
  parts, the notices before a setting is stored, a check job's run panel, and the forms of every register.
- MOD-markdown-render.renderArtifact — a source's or resource's entry as it will be written.
- MOD-browser-store.openStore, MOD-browser-store.readSetting, MOD-browser-store.writeSetting,
  MOD-browser-store.clearSetting, MOD-browser-store.clearEverything, MOD-browser-store.listSettings,
  MOD-browser-store.exportSettings, MOD-browser-store.importSettings, MOD-browser-store.expiringSoon — every browser
  setting, its export and import; MOD-browser-store.readExport — the tokens an import file holds, read before the import;
  MOD-browser-store.secretValues — the stored secrets a host it connects refuses to commit
  (`NO SECRET IN THE REPOSITORY`).
- MOD-repository-hosts.parseAddress, MOD-repository-hosts.connect, MOD-repository-hosts.readSnapshot,
  MOD-repository-hosts.repositoryInfo — products and the instance, a token's test, a repository's visibility;
  MOD-repository-hosts.commitFiles — the commit plans of a source's registration or new version, and the job workflow
  files; MOD-repository-hosts.startWorkflow — *Fetch again*; MOD-repository-hosts.listReleaseAssets — the Bridge's files
  with their sizes and SHA-256; MOD-repository-hosts.webLinks — the server's token, fork, Pages, Actions, secrets and
  access-token pages.
- MOD-identifiers.pagesAddress — the instance's dashboard address: the page *Open your dashboard* opens in
  `get-your-own` (UC-014 step 4), and the return address of a mailbox's app registration.
- MOD-bridge-client.settingsOf, MOD-bridge-client.bridgeAt, MOD-bridge-client.pair, MOD-bridge-client.testBridge,
  MOD-bridge-client.probe — each Bridge's address, pairing, tests, the agents a Bridge offers, a resource's check;
  MOD-bridge-client.allocatePort, MOD-bridge-client.tunnelCommands, MOD-bridge-client.proxyConfiguration — the Bridges
  reached through the jump host, and the jump host.
- MOD-endpoint-calls.testEndpoint, MOD-endpoint-calls.diagnoseEndpoint — an endpoint's test and why a browser may not
  call it.
- MOD-endpoint-calls.modelContext — the context an endpoint states for its model, kept after a working test.
- MOD-mail-routes.routeFor, MOD-mail-routes.signIn, MOD-mail-routes.mailbox, MOD-mail-routes.providerLinks — the
  mailbox's route, sign-in and test, and Microsoft's pages for the app registration and for withdrawing its access.
- MOD-documents.readDocument, MOD-documents.readRegister, MOD-documents.writeDocument — registers of the common shape and
  the text a save writes; MOD-artifact-edits.saveFile — a person's edit of one register, only on the blob it was opened
  on; MOD-artifact-edits.reviewLayoutCommit — the review layout of a new product.
- MOD-participant-list.participantSchema, MOD-participant-list.participantsOf — the participant register and its
  participants; MOD-participant-list.reachedThrough — the CLI agent a subagent is reached through, kept when its row is
  changed; MOD-product-process.declarationSchema, productWorkflow, roleAssignmentSchema — the products and roles that use
  a participant: each product's roles from its declared workflow, and who fills them from its role assignments, since the
  declaration names roles and never participants; MOD-product-process.roleAssignmentFindings — the assignments that a
  changed participant makes invalid, such as a holder that lacks a capability its role needs, shown before the change is
  saved (UC-017 7a).
- MOD-source-register.sourceSchemas, MOD-source-register.registrationCommits, MOD-source-register.versionCommits,
  MOD-source-register.linkedVersion, MOD-source-register.affectedRequirements, MOD-source-register.changedPassages,
  MOD-source-register.recogniseLegalText, MOD-source-register.permittedPlaces — the source library and a product's links;
  MOD-source-register.readContent — the contents of two versions, whose changed passages *Move* lists.
- MOD-text-tools.sha256 — the files of a source hashed in the browser; MOD-text-tools.finding — the findings a form's
  checks give.
- MOD-resource-list.resourceSchema, MOD-resource-list.resourceFindings, MOD-resource-list.readPin,
  MOD-resource-list.checkPlan, MOD-resource-list.newerState, MOD-resource-list.namedBy — resources, and the jobs and
  tests that name one; MOD-resource-list.resourceStrategies — the
  recipe of a check job, handed to the frame; MOD-reuse-facts.registryFacts, MOD-reuse-facts.hubFacts, MOD-reuse-facts.repositoryFacts — what a
  repository or the Hugging Face Hub says about a resource.
- MOD-personal-data.settingsSchemas, MOD-personal-data.pseudonymisationOf, MOD-personal-data.namedPersonFindings — a
  product's pseudonymisation and collaborators, and the files that still name a collaborator who withdrew.
- MOD-job-runner.prepareJob, MOD-job-ledger.newJobId, MOD-runtimes.routesFor, MOD-runtimes.queueJob — a resource's check
  job on its runner; MOD-runtimes.jobWorkflowFiles — the job workflow a product needs; MOD-runtimes.gitlabVariableScopes
  — on GitLab, the environment scopes its variables need.
- MOD-prompt-bar.recordingSchema, MOD-prompt-bar.recordingOf — the instance's switch of recording conversations;
  MOD-prompt-bar.Subject — the subject its routes give the prompt bar; MOD-prompt-bar.endpointsOffered,
  MOD-prompt-bar.spawnEndpointJob, MOD-prompt-bar.followJob — the test job of an endpoint that runs through GitHub Actions.
- MOD-prompt-bar.endpointLacks — what an endpoint lacks for the prompt bar to offer it, named on its line and on its own page (UC-049 1b).
- MOD-repository-hosts.setCiSecret — an endpoint's key stored as a GitHub Actions secret, on the person's click.
- MOD-repository-hosts.ciVariableScopes — a GitLab product's CI/CD variables by name and scope, checked against the scopes
  the job workflow needs.
- MOD-notifications.NotificationState, MOD-notifications.notificationState, MOD-notifications.switchOn,
  MOD-notifications.testNotification, MOD-notifications.switchOff — the line *Notifications*: its state, *Switch on* in
  the person's click, *Test* and *Switch off*.
