## 10. Review on GitHub Pages

**THE PAGES ROOT IS THE REPOSITORY ROOT** *(PO A. Maier)*
The GitHub Pages site of an Agent M instance is served from the root of its default branch.
*Check:* `tests/test_pages_layout.py`

**THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE** *(PO A. Maier)*
The page at the root of the instance's Pages site is the dashboard of what goes on in the instance — the progress
of each product and every job.
*Check:* `tests/test_main_page.py`

**THE MENU FOLLOWS THE PROCESS** *(PO A. Maier)*
The menu of the instance's site lists the requirements, the use cases, the architecture, the implementation, the tests and
the releases in this order, followed by the maintenance — issues and mail — and the settings.
*Check:* `tests/test_main_page.py` — the menu's entries stand in this order; counter-proof: a menu with two stages swapped
fails.

**THE MAIN PAGE SHOWS EACH PRODUCT'S PROGRESS BY STAGE** *(PO A. Maier)*
The main page shows each product's progress as one bar of six stages — requirements, use cases, architecture,
implementation, tests, release —, each filled by the share of its work that is accepted or done.
*Check:* `tests/test_main_page.py` — a fixture product with three of its four use cases accepted shows its use-case stage
at 75 %; counter-proof: with all four accepted, at 100 %.

**WITHOUT A PRODUCT, THE MAIN PAGE SHOWS AGENT M'S OWN PROGRESS** *(PO A. Maier)*
While the instance manages no product, the main page shows Agent M's own progress in the same bar, which is full once
Agent M's first release is tagged.
*Check:* `tests/test_main_page.py` — without a product the bar shows Agent M; counter-proof: with one product, the
product.

**THE BUILD IS SHOWN AS IT HAPPENS** *(PO A. Maier)*
While a product is implemented, the main page shows the steps of its implementation plan or its backlog items that are in
progress, each with the job working on it.
*Check:* `tests/test_main_page.py` — a fixture product with a running job shows the job beside its step; counter-proof:
once the job has ended, the step shows done.

**THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK** *(PO A. Maier)*
The instance's site uses the colours of the FAU's Faculty of Engineering as lme.tf.fau.de shows them — FAU blue
`#04316a`, dark blue `#041e42`, metallic `#8c9fb1` — and the logo of the Pattern Recognition Lab.
*Check:* no automatic check; at review.

**EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE** *(PO A. Maier)*
Every page of the instance's site draws its header, menu, buttons, tables and lists with the same style sheets; every
button and link meets WCAG 2.2's minimum target size (success criterion 2.5.8); and every page reflows as WCAG 2.2's
success criterion 1.4.10 asks, so that its text, tables and lists are read on a phone without scrolling sideways.
*Check:* `tests/site-usability.test.mjs` — each route, drawn at a phone's width and at a desktop's, uses the site's style
sheets only, offers no button or link below the minimum target size, and holds no element wider than the window;
counter-proof: a planted table wider than a phone fails.

**THE SITE SERVES A SCREEN READER** *(PO A. Maier)*
Every page of the instance's site meets WCAG 2.2 at level AA, so that a person can use it with a screen reader: every
control has an accessible name, every image a text alternative, every page its landmarks and headings in order, and no
status is given by colour alone.
*Check:* `tests/site-accessibility.test.mjs` — an automatic check of each route against WCAG 2.2 level AA finds no
violation; counter-proof: a planted button without a name fails.

**DOCUMENTS ARE REVIEWED AND EDITED UNDER DOCS** *(PO A. Maier)*
Documents are reviewed and edited on the page under `docs/` of the instance's Pages site.
*Check:* `tests/test_pages_layout.py`

**AGENT M'S SOURCE CODE LIVES IN SRC** *(PO A. Maier)*
Every script, style sheet and library of Agent M lives under `src/` of its repository, apart from its tests and its
CI workflows.
*Check:* `tests/test_pages_layout.py` — no script, style sheet or library of Agent M lies outside `src/`, `tests/` and
`.github/workflows/`.

**ONE REVIEW LAYOUT FOR EVERY PRODUCT** *(PO A. Maier)*
Agent M and every managed product use the same layout below `docs/`: use cases in
`docs/use-cases/`, architecture decisions in `docs/architecture/`, SPEC change queues in
`docs/spec-freigaben/`, approval records in `docs/approvals/`.
*Check:* `tests/test_pages_layout.py`

**ONE USE CASE, ONE FILE** *(PO A. Maier)*
Each use case is a single Markdown file named `docs/use-cases/UC-<nnn>-<slug>.md`.
*Check:* `tests/test_usecase_fields.py`

**ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON** *(PO A. Maier)*
A use case, an architecture decision or a SPEC change is accepted by a commit, made under the accepting
person's own account on the server that hosts the repository, that adds an approval record to
`docs/approvals/`.
*Check:* `tests/test_approval_records.py`

**AN APPROVAL NAMES THE EXACT TEXT** *(PO A. Maier)*
An approval record names the file it approves and the git blob SHA of the text the reviewer saw.
*Check:* `tests/test_approval_records.py`

**STATUS IS DERIVED FROM THE RECORDS** *(PO A. Maier)*
A reviewed file counts as accepted exactly when an approval record names its current blob SHA; a SPEC change entry
also counts as decided when its queue's decision row names the commit that wrote it into the SPEC.
*Check:* `tests/review-core.test.mjs`

**A PROPOSAL IS REJECTED WITH A REASON** *(PO A. Maier)*
Beside **Accept**, the dashboard offers **Reject** for every use case, architecture decision and SPEC change entry it
offers to accept, and writes the rejection only once the person has typed a reason.
*Check:* `tests/review-core.test.mjs` — an open use case, an architecture decision and a SPEC change entry each offer
Reject; counter-proof: Reject without a reason writes nothing.

**A REJECTION REMOVES THE PROPOSAL** *(PO A. Maier)*
A rejection is one commit under the rejecting person's own account, with the reason in its message: a SPEC change
entry leaves its queue, and a use case or architecture decision returns to the text its most recent approval record
names, or leaves the working tree when no record names it.
*Check:* `tests/review-core.test.mjs` — rejecting a changed use case restores its accepted text in one commit whose
message holds the reason; counter-proof: rejecting a never-accepted one removes the file.

**THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK** *(PO A. Maier)*
The dashboard writes to a repository only as the direct result of a person's action on it, as a
commit made with that person's own token.
*Check:* `tests/review-core.test.mjs`

**WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK** *(PO A. Maier)*
Without a stored token, accepting, rejecting and editing open GitHub's web interface with the commit
prepared as far as GitHub allows.
*Check:* `tests/review-core.test.mjs`

**EDITS ARE PREPARED ON THE DASHBOARD** *(PO A. Maier)*
The dashboard offers an editor with a live preview for a reviewed file, and saving commits the
edited text under the person's own account.
*Check:* `tests/review-core.test.mjs`

**NO TEXT TRAVELS IN A URL** *(PO A. Maier)*
A link that prepares a commit in GitHub carries at most a file path and an approval record, never
the reviewed text.
*Check:* `tests/review-core.test.mjs`

**AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL** *(PO A. Maier)*
With a stored token, accepting a SPEC change commits the approval record and the replaced SPEC
section together, in one commit, with the approved proposal text byte for byte.
*Check:* `tests/review-core.test.mjs`

**WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE** *(PO A. Maier)*
When an approval record for the instance's own SPEC is committed without the dashboard, the
instance's workflow writes the approved section byte for byte.
*Check:* `tests/test_apply_approvals.py`

**A STALE APPROVAL IS NOT APPLIED** *(PO A. Maier)*
Nothing is written when the proposal or the current SPEC section differs from the blob SHAs named in
the approval record.
*Check:* `tests/test_apply_approvals.py` · `tests/review-core.test.mjs`

**AN INSTANCE IS A FORK OF AGENT M** *(PO A. Maier)*
A person or team runs Agent M as their own fork, and the fork's Pages site is the dashboard for the
products that instance manages.
*Check:* `tests/test_instance_target.py` — the dashboard derives its own repository from the Pages
address it is served from.

**A MANAGED PRODUCT NEEDS NO PAGES SITE** *(PO A. Maier)*
A managed product keeps its artifacts below `docs/` in its own repository and is reviewed through
the instance's dashboard, never through a site of its own.
*Check:* no automatic check; at review.

**THE DASHBOARD KEEPS ITS PRODUCTS IN THE BROWSER** *(PO A. Maier)*
The dashboard keeps the addresses of the products it manages in the browser's `localStorage`, beside
the tokens that reach them.
*Check:* `tests/review-core.test.mjs` — adding a product stores its address in `localStorage` and
commits nothing to the instance repository; counter-proof: after a clear, the list is empty.

**NO PRODUCT IS NAMED IN THE INSTANCE REPOSITORY** *(PO A. Maier)*
No file committed to the instance repository names a product the instance manages.
*Check:* `tests/test_products_folder.py` — the instance repository's committed files contain no
address of a product in the fixture list; counter-proof: a fixture that commits one fails.

**A LOCAL CLONE HOLDS ITS PRODUCTS IN ITS PRODUCTS FOLDER** *(PO A. Maier)*
In a local clone of Agent M, each product checked out is a clone of its repository in its own folder
under `products/`, which git ignores except for `products/README.md`.
*Check:* `tests/test_products_folder.py` — `products/README.md` is tracked; a folder created under
`products/` is ignored by git.

**SEVERAL FILES ARE ACCEPTED IN ONE CLICK** *(PO A. Maier)*
A reviewer who has been shown several reviewed files — opened one by one, or together on one review page
— may accept all of them with one click, in one commit that holds one approval record per file, each
naming the text shown.
*Check:* `tests/review-core.test.mjs` — a batch writes one record per file shown, and none for a file that
was not shown; counter-proof: a file changed after it was shown is left out and named, and a file the
review page could not show — one whose named requirements are not all accepted — gets no record and is
named.

**A QUEUE IS ACCEPTED IN ITS ORDER** *(PO A. Maier)*
Entries of one queue accepted together are written in the order of the queue's index, in one commit,
and an entry whose anchor another entry creates is offered only together with or after that entry.
*Check:* `tests/review-core.test.mjs` — accepting 05 and 06 together yields one commit with both
sections; counter-proof: 06 alone is not offered while its anchor is missing, and the dashboard names
05.

**A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE** *(PO A. Maier)*
A SPEC edit saved on the dashboard is added to the person's newest queue of the same day that has no
accepted entry yet, and opens a new queue only if there is none.
*Check:* `tests/review-core.test.mjs`

**EVERY STEP EXPLAINS ITSELF** *(PO A. Maier)*
Every step that asks something of the person carries an explanation that can be expanded, written
for someone new to GitHub.
*Check:* `tests/site-frame.test.mjs`, `tests/settings-pages-add-product.test.mjs`, `tests/settings-pages-setup.test.mjs` —
each step of the add-product page and of *Finish setting up* carries the folded explanation of its topic; counter-proof:
a topic the explanations file does not hold shows nothing and is reported by the frame's own check.

**A PRODUCT IS NAMED BY ITS ADDRESS** *(PO A. Maier)*
A product is identified by the web address of its repository, on `github.com` or on a GitLab server.
*Check:* `tests/review-core.test.mjs`

**GITLAB PRODUCTS ARE SUPPORTED** *(PO A. Maier)*
Agent M reads and writes products on any GitLab server whose API accepts requests from the instance's
Pages address.
*Check:* `tests/review-core.test.mjs`

**A GITLAB PRODUCT IS WRITTEN WITH A TOKEN** *(PO A. Maier)*
Accepting and editing in a GitLab product require a stored token; there is no web-interface fallback.
*Check:* `tests/review-core.test.mjs`

**A SPEC EDIT IS SAVED AS A PROPOSAL** *(PO A. Maier)*
Saving a change to a product's SPEC on the dashboard — typed or drafted by a participant — writes an entry to a change queue under `docs/spec-freigaben/` instead of writing the
SPEC.
*Check:* `tests/review-core.test.mjs` — a save from the editor leaves `SPEC.md` byte-identical.

**A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE** *(PO A. Maier)*
Saving an edit writes nothing when the file or SPEC section on the default branch differs from the
version the edit started from.
*Check:* `tests/review-core.test.mjs`

**A REFUSED SAVE KEEPS THE EDIT** *(PO A. Maier)*
When a save is refused, the edited text stays in the editor, shown beside the newer version.
*Check:* `tests/review-core.test.mjs`

**AN EDITED FILE KEEPS ITS IDENTIFIER** *(PO A. Maier)*
Saving is refused for a use case, architecture decision or test whose identifier differs from the one it was
opened with.
*Check:* `tests/review-core.test.mjs`

**A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED** *(PO A. Maier)*
An edit that changes a requirement's name is proposed as the withdrawal of the old name together with
a new requirement under the new name.
*Check:* `tests/review-core.test.mjs`

**A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT** *(PO A. Maier)*
Text that a participant returns to the dashboard from a person's instruction is shown as a difference
against the current text before the person can save it.
*Check:* `tests/review-core.test.mjs`

**A CI AGENT'S DRAFT ENTERS AS OPEN** *(PO A. Maier)*
A change that a CI agent drafts from a person's instruction is committed to the default branch only as
an open use case or as an entry of a SPEC change queue.
*Check:* `tests/test_prompted_change_context.py` — a CI-agent fixture's prompted change yields an open
use case or a queue entry and leaves `SPEC.md` byte-identical; counter-proof: neither is shown as
accepted.

**A PROMPTED REQUIREMENT CHANGE FOLLOWS THE DERIVATION RULES** *(PO A. Maier)*
A change to requirements that a participant drafts from a person's instruction is subject to
`DERIVATION SEES THE EXISTING REQUIREMENTS`, `NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY`,
`A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT` and `EXACT DUPLICATES ARE FOUND WITHOUT A
MODEL`, as a derivation from a source is.
*Check:* `tests/test_derivation_context.py` · `tests/test_derivation_classes.py`

**A PROMPTED USE-CASE CHANGE SEES ITS NEIGHBOURS** *(PO A. Maier)*
A participant asked to change a use case receives, besides the use case, every requirement it
realises and every other use case of the product.
*Check:* `tests/test_prompted_change_context.py`

**NO USE CASE IS LEFT OUT OF A PROMPT SILENTLY** *(PO A. Maier)*
If a use case, its requirements and the product's other use cases do not fit into the participant's
context, nothing is sent and the dashboard says what does not fit.
*Check:* `tests/test_prompted_change_context.py`

**A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT** *(PO A. Maier)*
For a reviewed file that has changed since it was accepted, the dashboard shows the difference between
the text named by the most recent approval record for the same identifier and the current text.
*Check:* `tests/review-core.test.mjs` — a use case with one changed line shows exactly that line against its
last accepted text; counter-proof: with two approval records, the older text is not the one compared.
