---
id: MOD-site-frame
title: The frame every page shares
folder: src/site-frame/
realises:
follows:
  - ARC-038
uses:
  - MOD-markdown-render.renderArtifact
  - MOD-markdown-render.openEditor
  - MOD-browser-store.openStore
  - MOD-browser-store.readSetting
  - MOD-browser-store.expiringSoon
  - MOD-browser-store.secretValues
  - MOD-repository-hosts.parseAddress
  - MOD-repository-hosts.connect
  - MOD-repository-hosts.webLinks
  - MOD-repository-hosts.HostError
  - MOD-repository-hosts.Snapshot
  - MOD-repository-hosts.readSnapshot
  - MOD-repository-hosts.repositoryInfo
  - MOD-job-runner.registerStrategies
  - MOD-job-runner.Strategies
  - MOD-job-runner.Prepared
  - MOD-documents.Schema
  - MOD-documents.Document
  - MOD-documents.documentFindings
  - MOD-documents.readDocument
  - MOD-text-tools.Finding
  - MOD-identifiers.instanceOfPagesAddress
  - MOD-notifications.watchForAcceptance
  - MOD-prompt-bar.startPromptBar
  - MOD-prompt-bar.Subject
  - MOD-prompt-bar.handOverStrategies
  - MOD-source-register.registerPaths
  - MOD-progress-measures.storedOverview
provides:
  - View
  - Route
  - ViewContext
  - PageSetup
  - startPage
  - embedRoute
  - menuOf
  - instanceOf
  - chosenProduct
  - productHostFollowingStore
  - tokenKeyOf
  - explain
  - runPanel
  - confirmDecision
  - notice
  - schemaForm
  - readProblem
---
# MOD-site-frame The frame every page shares

## Responsibility

It belongs to the Site (ARC-038). Its one responsibility is what every page of the instance's site has in common: the
header with the lab's logo and the menu in the order of the process, the footer of the main and the review pages, the look of the Pattern Recognition Lab, the
product selector, the notices, the routing of views by the address's fragment, the instance derived from the Pages
address, the folded explanations, the run panel, the dialog of a decision, the form built from a schema, and the start of
the checks of what waits for the person's acceptance, which MOD-notifications runs on the main and the review pages, and
the start of the prompt bar, which MOD-prompt-bar draws on the same pages, with the subject of the route shown. It is
the plug-in manager of the Site's views: an entry page names the view modules it carries, and the frame loads them through
the `View` interface it defines and routes to them. It registers with the job runner the strategies that the views and
the prompt bar hand it, each set once however many hand it. It never names a view itself.

It runs in a browser — the instance's pages, and the Bridge's window, which is drawn with it (ARC-040).

## Parts

- `index.mjs` — the interface.
- `start.mjs` — the script both entry pages load: it reads the page's setup from its own script tag, loads the named
  view modules from their folders, registers their strategies and MOD-prompt-bar's `handOverStrategies` with
  `register.mjs`, and calls `startPage`. This is where the entry pages register strategies (ARC-038).
- `register.mjs` — `registerViews`: every strategy set of a page's views, under its view's slug, and then
  MOD-prompt-bar's `handOverStrategies` under `MOD-prompt-bar`, each set once per load, at load — so that a job any
  route prepares, the test job of an endpoint on the Settings page among them, finds every recipe of the page's views.
  `start.mjs` and the live page's app (`dashboard-app.mjs`) both register with it.
- `attachPromptBar` (index.mjs) — MOD-prompt-bar's bar started in a footer fixed to the bottom of the window, which takes the
  bar's height: `startPage` attaches it on the main page, and `dashboard-app.mjs` on every review page once its load has read
  the instance, with the subject of what the page shows (`subjectOf`) (UC-049 step 1).
- `preloads.mjs` — the block of preloads in the `<head>` of each entry page, `index.html` and `docs/index.html`, so that a
  browser asks for every file the page loads as it starts at once, not level by level as it finds the imports: a
  `<link rel="modulepreload">` for each module of the static import closure of the page's module script and of the views its
  `data-views` names (a JSON module with `as="json"`), and a `<link rel="preload" as="fetch" crossorigin>` for each file those
  modules fetch as they are evaluated, found by evaluating them in a separate Node process as a browser runs them. A module a
  route imports only when it is shown is not preloaded, so the main page preloads none of the review pages' views. Run in
  Node: `node src/site-frame/preloads.mjs` writes the blocks; `tests/site-frame-preloads.test.mjs` fails while a page's block
  differs from what it computes. No build stands between the repository and the page: the block is part of the page's text.
- `menu.mjs` — the eight entries of the menu and the links they lead to, and the button that folds them on a narrow
  screen.
- `footer.mjs` — the footer of the main and the review pages: the book *Vibe Coding* (Springer,
  `https://link.springer.com/book/9783032399069`) and the Pattern Recognition Lab of FAU Erlangen-Nürnberg
  (`https://lme.tf.fau.de/`), each a link; that no server is operated and that a page writes only when the person
  clicks, one commit under the person's own account; and a link to Agent M's source repository, the upstream instance
  named in the frame's data, where its MIT licence stands.
- `routing.mjs` — views by the address's fragment, and the address of a route for a repository.
- `notices.mjs`, `run-panel.mjs`, `decision.mjs`, `forms.mjs` — notices, the run panel, the dialog of a decision, the
  form built from a schema.
- `subject.mjs` — the subject of the route shown, its own or the frame's default, with the menu entry of the page shown,
  the one the menu marks.
- `look.css` — colours, fonts and the header, footer and menu of the lab's look: FAU blue `#04316a`, dark blue `#041e42`,
  metallic `#8c9fb1`, and their tints, for light and dark mode; and how a page reflows on a phone, one rule for every route
  (`EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE`):
  - **A table** below a phone's width (600 px) takes its narrow form: each row is a block whose cells stand one under
    another, and a table, its rows and its cells are never wider than the window. A cell is labelled by its column: the
    label is the cell's attribute `data-label`, which the route that draws the table sets to the column's title, and the
    stylesheet shows it before the cell's content; a cell without the attribute stands unlabelled. A route that draws a table
    sets `data-label` on each cell and no style of its own, so `#backlog`, `#roles`, `#arc` and `#module` take the same rule.
  - **The menu** on a screen up to 760 px wide is the button `menu.mjs` draws: its click unfolds the eight entries one
    under another, and a second click folds them. Wider, the button is not shown and the entries stand in a row.
  - **The burn-down chart** is drawn at the width the property `--burn-down-width` (700 px) gives it, and, in a window
    narrower than that, no wider than the window less the page's margins; the property holds the width the route asks
    Mermaid for. Its text is the page's body text in size at every width, so a narrower chart is drawn with fewer labels
    on its axes, never with smaller ones.
- `brand/` — the logo files of the Pattern Recognition Lab, lettered and as a sign, for light and dark backgrounds, the
  page icons, and a `README.md` stating the terms under which the logo is used.
- `explanations.md` — the folded explanations, as data.
- **Taken over, outside this folder** (`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; the count in `docs/measurements/2026-10-17_code-outside-every-module.md`). Each file goes as stated, in this module's own implementation jobs:
  - `docs/index.html`: named here as the review pages' entry page, whose place the Pages site fixes; it loads `start.mjs` once the live dashboard's views are the modules' routes. It loads no library for Markdown, sanitising or diagrams: the app's Markdown is rendered with `renderArtifact`.
  - `src/site-frame/dashboard-app.mjs`: the live page's app; its loading reads through `Snapshot.readMany`, the files a route shows in its first wave — for the specification, a product's `docs/sources.md` and the register's entries among them (`registerPaths`); its Markdown is rendered with `renderArtifact`, and it imports no library of the renderer's `vendor/`; for a route of a loaded view it shows, `#trace` among them, the entry it marks in the menu and gives the bar's subject is the entry of the page shown, by the same rule as on the frame's pages — the route's `entryShown`, else its `entry` —, in place of the lookup by view name of `src/site/menu.mjs`; removed once `docs/index.html` starts the site through `start.mjs`.
  - `docs/assets/dashboard/built.json`, `src/site/views.mjs`: removed with the app: `data-views` names the views.
  - `src/site/html.mjs`, `src/site/instance-repository.mjs`, `src/site/menu.mjs`: removed once their callers use `instanceOf` and `menuOf`.
  - `src/theme/lme.css`, `src/brand/`: removed: `look.css` and `brand/` hold them.
  - `tests/app-harness.mjs`: moved in as the helper of this module's page tests; it serves the batch request (`POST /graphql`) and, after the switch, loads `start.mjs`.
  - `tests/load-per-view.test.mjs`: its header names this module: the Check of `A PAGE LOAD READS THE REPOSITORY IN BATCHES`.
  - `tests/dashboard-shell.test.mjs`, `tests/review-page.test.mjs`, `tests/release-sprint-01-dashboard-app.test.mjs`, `tests/release-sprint-02-a-dashboard-app.test.mjs`, `tests/release-sprint-02-d-dashboard-app.test.mjs`, `tests/review-core.d/dashboard-app.test.mjs`, `tests/review-core.d/write-refused.test.mjs`, `tests/test_instance_target.py`, `tests/test_progress_derived.py`: their headers name this module while the app is its; each is removed or rewritten on the frame's routes with the part of the app it tests.
  - `tests/test_pages_layout.py`: its header names this module: the pages' layout is the frame's.

## Data

It keeps nothing but what is on the screen. It owns these formats:

- **The page setup**, written by an entry page in the attributes of the script tag that loads `start.mjs`:
  `data-page` — `main` or `review`; `data-views` — the slugs of the view modules this page loads. Example: `<script type="module" src="../src/site-frame/start.mjs" data-page="review"
  data-views="review-pages trace-pages implementation-pages test-pages maintenance-pages settings-pages"></script>`.
- **The explanations file** `explanations.md`: one section `## <topic>` per topic, its body the Markdown shown when the
  explanation is unfolded; a topic is a lower-case slug, for example `## shared-pages-origin`. It holds the topics of the
  site's pages and those of the Bridge's window, which is drawn with this frame (ARC-040): the coding agents and how to
  install a missing one, the pairing token and pairing anew, the jump host and the public key, the tunnels, importing a
  settings export, updates, and why a newly signed release may still be warned about. A topic that a view or the
  Bridge's window names and the file does not hold is a finding of the frame's own check, which compares the topics
  named with the file's, never a failure at run time.
- **The view interface**: `View`, `Route`, `ViewContext` and `PageSetup`, below.

## Interfaces

- `View` — what a view module provides to the frame: `{ routes: Route[], strategies: Strategies[] }` — its routes, and
  the strategy sets of the services whose job kinds its routes prepare or run in the tab (MOD-job-runner's
  `Strategies`).
- `Route` — `{ name: string, entry: "requirements" | "use-cases" | "architecture" | "implementation" | "tests" |
  "releases" | "maintenance" | "settings" | null, entryShown?: (params: Record<string, string>) -> Route["entry"],
  title: string, render(target: Element, context: ViewContext,
  params: Record<string, string>) -> Promise<void>, subject?: (params: Record<string, string>, context: ViewContext) ->
  Subject | null, leave?: () -> boolean, unsaved?: () -> boolean,
  reads?: (params: Record<string, string>, snapshot: Snapshot) -> Promise<string[]> }`. Before the frame shows another route on a change of the address, it asks the
  route shown with `leave`; `false` keeps that route and puts its address back. `unsaved` tells, without asking the
  person anything, whether the route shown holds changes that leaving it would discard; a route that gives none holds none. `reads` names the files the route will read, as paths of the `snapshot` it is given, the repository the route shows as the frame has read it for the page;
  the frame reads them with `readMany` before it calls `render`, a hundred to a batch (`A PAGE LOAD READS THE REPOSITORY IN BATCHES`), and keeps no list of files for any route. A route whose
  files depend on files it must read first reads those through `snapshot.readMany` itself, in `reads`. `name` is the first part of the address's fragment, the rest are its `params`; a route's `entry` puts it
  under that entry of the menu, `null` keeps it out of the menu: it is the entry `menuOf` counts as served, and the one
  whose first route a fragment naming the entry and no route shows. `entryShown` names the menu entry of the page the route
  shows for these `params`, for a route whose pages lie under more than one entry; its `null` means the route's `entry`,
  not a page out of the menu, so it never takes a route out of the menu; where a route gives none, the page shown is
  under the route's `entry`. The entry of the page shown is the one the menu marks and the one the subject carries.
  `menuOf` counts only `entry` as served: a page whose `entryShown` names an entry that no loaded route lists is marked
  under an entry the menu shows as *not built yet*. `subject`, MOD-prompt-bar's type, says what a message in
  the prompt bar is about while the route is shown — a route showing a requirement, a use case or an architecture file
  names its change kind and its target; a route of mail or of settings says what of its page a participant may be given.
  Whichever gives the subject, the frame sets its `entry` to the entry of the page shown. A route that gives none, or whose
  `subject` gives `null` for these parameters, has the frame's default: the kind `converse`, the route's title, and as the page the route's title, the menu entry of the page shown, the product, and the text the route has drawn, which holds no stored secret, since a stored
  secret is shown only in a hidden field (`A STORED SECRET IS HIDDEN UNTIL SHOWN`).
- `ViewContext` — what every route is given: `{ page: "main" | "review" | "bridge", instance: { repository: string,
  host: Host }, product: ProductContext | null, store: Store, go(route: string, params?: Record<string, string>) -> void }`
  — `Host` and `Store` as
  MOD-repository-hosts and MOD-browser-store define them; `ProductContext` is `{ address: string, kind: "github" |
  "gitlab", host: Host, tokenStored: boolean }`, `tokenStored` telling whether this browser keeps the product's own
  token, so that a view hands `readProblem` the fact without reading the store's keys itself. `go` writes the chosen
  product into the address unless `params` names a `product`; the empty `product` names the instance itself, and the
  address then holds none.
- `PageSetup` — `{ page: "main" | "review" | "bridge", views: View[] }`.
- `startPage(setup: PageSetup) -> Promise<void>` — draws the header, the menu, whose links carry the chosen product as
  `menuOf` gives them and in which the entry of the page shown is marked, and the product selector, shows the notices, connects the instance and the chosen product, and renders the route the fragment names, again on every
  change of the fragment. A route whose rendering fails is replaced in its place by `readProblem` of that failure, except
  a refused token, which is shown as a notice. While the route shown reports `unsaved` true, closing or reloading the tab
  makes the browser ask first, in the words the browser gives that question. A fragment that names no loaded route shows the first route of its menu entry, or says that
  the entry is not built yet. On the main and the review pages, never in the Bridge's window, it starts MOD-notifications'
  `watchForAcceptance` with the page's store, the instance as it connected it, a host for each product, which it
  connects as the instance's — through the token and the stored secrets this browser holds at each call —, and its own
  writing of the address of a
  route of the review pages, for the instance itself or a product this browser keeps, in the form its routing and
  `chosenProduct` read back. On the same pages it draws the footer after the route and before the page's foot. In
  the page's foot it starts MOD-prompt-bar's `startPromptBar`, handing it
  the store, the instance, the chosen product, the subject of the route shown at each moment, its own `explain` and its
  navigation, so that the prompt bar uses neither the frame nor a view. Called by `start.mjs`, and by the Bridge's
  window with its own routes, where no prompt bar is drawn.
- `embedRoute(name: string, target: Element, params: Record<string, string>) -> Promise<void>` — renders a route of
  another view loaded on the same page inside an element of the calling view, so one view can show another's part
  without using it. Error: `RouteNotLoaded` — the route is not on this page; the frame then puts a link to it in
  `target`.
- `menuOf(page: "main" | "review", loaded: string[], product?: string | null) -> MenuEntry[]` — the entries in the order
  of `THE MENU FOLLOWS THE PROCESS`: Requirements, Use cases, Architecture, Implementation, Tests, Releases, then
  Maintenance and Settings; each `{ key, label, href: string | null, title }`; on the review pages `href` null and `title`
  saying *not built yet* for an entry no loaded view serves. On the main page each entry links into the review pages,
  which say there when an entry is not built yet, so that the main page loads none of their views. With `product`, the
  address of a product this browser keeps, each `href` that is not null ends in `/product=` and the address percent-encoded,
  the form `chosenProduct` reads back; without it, or with null, it is the entry's alone. The entry Requirements leads
  to MOD-trace-pages' view `specification`; the list of SPEC change entries and their history are opened from it.
- `instanceOf(location: { hostname: string, pathname: string }) -> string` — the instance repository `owner/name` from
  the Pages address the page is served from (`AN INSTANCE IS A FORK OF AGENT M`), read with MOD-identifiers'
  `instanceOfPagesAddress`; on any other host, the upstream instance named in the frame's data.
- `chosenProduct(context: { store: Store, fragment: string }) -> Promise<ProductContext | null>` — the product the
  address's fragment or the selector names, among the products this browser keeps, connected with its own token to its
  own server only, with `tokenStored` true when that token is kept; `null` when the fragment or the selector names the instance itself, which the selector offers beside
  the products, or when the browser keeps no product — the pages then show the instance itself. Errors: `UnknownProduct`
  — the fragment names a product this browser does not keep; the selector offers *+ Add product*. A refused token or a
  used-up rate limit is shown as a notice, with what MOD-repository-hosts names.
- `productHostFollowingStore(page: { store: Store }) -> (product: string) -> Host` — the host of a product by its entry in
  `products`, for a caller that checks the products beside the page's route, as the notification checks do: each call of
  its functions goes through a connection made with the product's own token, its name and the stored secrets this browser
  holds at that call — the connection `chosenProduct` makes —, so that a token cleared or replaced since is not used and a
  commit that holds a stored secret is refused (`A CLEAR IS A REAL CLEAR`, `NO SECRET IN THE REPOSITORY`). One host for
  each product, however often it is asked for. Errors: the `TypeError` of MOD-repository-hosts' `parseAddress` for an entry that is no repository address.
- `tokenKeyOf(address: RepositoryAddress) -> string` — the key a product's own token is kept under in the browser's store: `github-token:<owner>/<repository>` for a GitHub product,
  `gitlab-token:<server>/<project>` for a GitLab product (MOD-browser-store, Data). It reads nothing and is the one place that rule stands, for the frame and for the pages that
  read a product's token setting, such as the name it is stored under.
- `explain(topic: string, label?: string) -> Element` — the folded *What is this?* of a topic, or the fold under the
  label a use case names for it (such as *Why these?*), from `explanations.md`, rendered by the
  renderer (`EVERY STEP EXPLAINS ITSELF`); used by the site's views and by the Bridge's window. It never throws: for a
  topic the file does not hold it returns an empty element, and the frame's own check reports the missing topic.
- `runPanel(prepared: Prepared, handlers: { onRun: () -> Promise<void>, onCancel?: () -> void }) -> Element` — the panel
  before a job runs (`THE PAGE NAMES WHERE IT SENDS`): every destination — the participant, its part as drafter,
  reviewer or checker, its model, where it processes data — and what goes there, part by part with its size against the
  participant's context and the requirement sources whose content it carries; what does not fit, and why, with how many requirements and use cases the destination holds and how many of them fit,
  from the `holds` and `fitting` of its `notFitting` entry (UC-019 4a); a part left
  out, with its reason; the findings that keep the job from starting; the limit of correction rounds fixed for it. *Run*
  is offered only when nothing keeps the job from starting and everything fits; pressing it is the decision and calls
  `onRun`. What the panel of a use case names besides — the route, the gates the jobs will meet, a run's limits — the
  view shows beside it.
- `confirmDecision(decision: { title: string, lines: string[], confirm: string, reason?: boolean }) -> Promise<{ confirmed:
  boolean, reason: string | null }>` — the one dialog of a decision: what will happen, in the given lines; with `reason`,
  a field the person fills in, as for rejecting a gate or recording a limitation.
- `readProblem(failure: Error, tokenStored: boolean) -> Element` — the problem a failed read of a repository shows on a
  page: for `NotFound` while this browser stores no token that reaches it, that the repository is private or does not
  exist and no token reaches it, with the link to store one (UC-008 1a, UC-020 2a); for any other host's failure
  (`HostError`), the host's own message, and the link to store a token where none is stored; for an error that is no
  host's failure, a fault of the page itself: that this page could not be drawn, with the error's message, and no link
  to a token.
- `notice(kind: "token-expiring" | "token-refused" | "rate-limit" | "unreachable" | "setup" | "moved" | "info", detail:
  { text: string, link?: { label: string, href: string } }) -> void` — shows a notice in the page's one place for them;
  the frame itself shows a token's expiry from fourteen days before it (`A TOKEN'S EXPIRY IS WARNED OF IN ADVANCE`) with
  its renewal page, and *Finish setting up* while no token is stored.
- `schemaForm(schema: Schema, document: Document | null, options: { onSave: (document: Document) -> Promise<void>,
  extraChecks?: (document: Document) -> Finding[], secretKeys?: string[], readOnly?: boolean }) -> Element` — a form with
  one field per key and section of a schema of MOD-documents, a section edited in the renderer's editor; the findings of
  `documentFindings` and of `extraChecks` shown beside their fields while typing — a document given without the identifier
  its schema names checked at the path the identifier typed gives it —; *Save* offered only while no error
  remains, so an invalid register is never saved; a key named in `secretKeys` shown hidden until *Show* (`A STORED
  SECRET IS HIDDEN UNTIL SHOWN`). It writes nothing itself: `onSave` does.

## Files

It reads its own `explanations.md`, `look.css` and `brand/` files, and the page setup from the entry page's script tag.
It reads the browser's store only through MOD-browser-store, and the repositories only through the hosts it connects.
It writes nothing.

## Uses

- MOD-markdown-render.renderArtifact — to render the explanations and the live page's Markdown; MOD-markdown-render.openEditor — for a section field
  of a form.
- MOD-browser-store.openStore, MOD-browser-store.readSetting — the products, tokens and the instance's key;
  MOD-browser-store.expiringSoon — the expiry notice; MOD-browser-store.secretValues — handed to every host it connects,
  which refuses a commit that would write one.
- MOD-repository-hosts.parseAddress, MOD-repository-hosts.connect — to connect the instance and the chosen product,
  each with its own token; MOD-repository-hosts.webLinks — the renewal page of a token; MOD-repository-hosts.HostError —
  to tell a host's failure from a fault of the page itself; MOD-repository-hosts.Snapshot — the type of the snapshot a route's `reads` is given, whose `readMany` the frame calls;
  MOD-repository-hosts.repositoryInfo, MOD-repository-hosts.readSnapshot — the default branch of the repository a route
  shows, asked once per page, and its snapshot there.
- MOD-job-runner.registerStrategies — the strategies the loaded views and the prompt bar hand it; MOD-job-runner.Strategies,
  MOD-job-runner.Prepared — the types of `View` and of the run panel.
- MOD-documents.Schema, MOD-documents.Document, MOD-documents.documentFindings — the form built from a schema;
  MOD-documents.readDocument — a section the person edited, read again by its schema, so that its rows are checked as
  typed before *Save* is offered.
- MOD-text-tools.Finding — the findings shown beside a form's fields.
- MOD-identifiers.instanceOfPagesAddress — the instance that the Pages address names.
- MOD-notifications.watchForAcceptance — the checks of what waits for acceptance, started on the main and the review
  pages.
- MOD-prompt-bar.startPromptBar, MOD-prompt-bar.Subject — the prompt bar, started on the main and the review pages, and
  the type of a route's subject; MOD-prompt-bar.handOverStrategies — the strategies a hand-over of the bar is prepared
  with.
- MOD-source-register.registerPaths — the register's entries among a tree's paths, so that the first wave of a page load names them beside the files its
  route shows and `#spec` reads the register in the same batch as its other files (`A PAGE LOAD READS THE REPOSITORY IN BATCHES`); the frame keeps no copy
  of the register's path.
- MOD-progress-measures.storedOverview — the change queues stored for the commit, read beside the first wave of `#spec`, so that
  its second wave names only the files of the queues with an entry not in the SPEC yet; where no overview is stored, the
  index and decisions of every queue are read, then the proposals of those still open.
