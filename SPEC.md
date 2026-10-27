# Agent M — Specification

**VERBINDLICH (SPEC)**

This is the single binding document of Agent M. A sentence belongs here when its violation would
be a defect. Everything else — how something is built, what was measured, what is planned —
belongs in `PLAN.md`, in `docs/measurements/`, or in the code, and does not bind.

**No section of this file is written by hand.** Each change is proposed in
`docs/spec-freigaben/<date>_<name>/`, shown on the review dashboard beside the text it would replace,
and written only when the Product Owner accepts it there (`ACCEPTANCE IS A COMMIT BY THE ACCEPTING
PERSON`).

**Form of a requirement:** a **name** in capitals that is its identifier and never changes, its
**source**, one **rule** stated as a single testable sentence, and the **check** that guards it. One
statement per requirement — an "and" in the rule means it is two. Why a rule exists is recorded with
the decision that accepted it; its history is in the version history.

---
## 0. Hard product rules

These five hold for every version of Agent M. A change to any of them is a change to what the
product is.

**NO SERVER** *(PO A. Maier)*
Agent M is delivered as a static site, repository conventions, and optional workflows; the project
operates no server, no account system and no database.
*Check:* `tests/test_no_backend.py` — the built site contains no call to an origin other than the
configured endpoints, the repository servers of the instance and its products, the mail provider's API
and sign-in, the local bridge, the jump host's HTTPS address, and the package registries and resource
hosts the page names before it calls them.

**ARTIFACTS ARE MARKDOWN** *(Vibe Coding, ch. 9 §6)*
Every artifact Agent M produces is Markdown, with diagrams written as Mermaid inside it.
*Check:* `tests/test_artifact_format.py`

**NO SECRET IN THE REPOSITORY** *(PO A. Maier)*
No API key, access token or endpoint credential is written into a repository managed by Agent M.
*Check:* `tests/test_no_secret_written.py` — a generated artifact containing a configured secret
value fails the run.

**THE PRODUCT REPOSITORY IS SELF-SUFFICIENT** *(PO A. Maier)*
Removing Agent M leaves a complete, readable set of artifacts behind in the product repository.
*Check:* `tests/test_self_sufficient.py` — no artifact references a file or service that exists
only inside Agent M.

**AGENT M IS MIT-LICENSED** *(PO A. Maier)*
Agent M is published under the MIT licence, stated in a `LICENSE` file at the root of its repository.
*Check:* `tests/test_licence.py` — the root `LICENSE` is the MIT text.
## 1. Identity and traceability

**EVERY ARTIFACT HAS AN IDENTIFIER** *(PO A. Maier)*
Every artifact Agent M produces carries an identifier: a requirement its name, every other artifact
one from the scheme `SRC-` · `UC-` · `ARC-` · `MOD-` · `TST-` · `ITM-` · `RES-` · `JOB-`.
*Check:* `tests/test_identifiers.py`

**THE NAME IS THE ID AND IT SURVIVES** *(PO A. Maier)*
An identifier travels with its artifact when the artifact moves between sections or files, and a
withdrawn identifier is never reused.
*Check:* `tests/test_identifier_stability.py` — an identifier that the version history holds and the current
files do not is never given to another artifact.

**A DOCUMENT HOLDS NO HISTORY** *(PO A. Maier)*
The specification, use cases, architecture decisions, backlog items and settings files state only what holds now;
earlier versions, withdrawn entries, and who changed what when are kept only in the version history.
*Check:* `tests/test_no_history.py` — none of these files carries a withdrawal note, an edit stamp or the date of a
change; records and dated measurements are not among them.

**EVERY ARTIFACT NAMES ITS ORIGIN** *(PO A. Maier)*
Each artifact names the identifiers of the artifacts it descends from: a requirement names its source, a use
case names the requirements it realises, an architecture decision names the requirements or use cases that force
it and the modules it designs, and a test names the requirement it guards and the module it exercises.
*Check:* `tests/test_origin_links.py`

**THE TRACEABILITY MATRIX IS DERIVED** *(PO A. Maier)*
The traceability matrix is computed from the artifacts and is never stored as a separately edited
document.
*Check:* `tests/test_matrix_derived.py`

**A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION** *(PO A. Maier)*
A cross-reference names the identifier it points at, never a section number or line number.
*Check:* `tests/test_references.py`

**ARTIFACTS ARE ARRANGED IN NESTED GROUPS** *(PO A. Maier)*
Requirements, use cases, architecture elements, modules and tests can each be arranged in a
hierarchy of named groups of any depth.
*Check:* `tests/test_groups.py`

**A GROUP CARRIES NO IDENTIFIER** *(PO A. Maier)*
A group is named by its title and carries no identifier of the kind `EVERY ARTIFACT HAS AN IDENTIFIER`
gives artifacts.
*Check:* `tests/test_groups.py` — no artifact names a group title where an identifier is expected.

**A GROUP HOLDS ONE KIND OF ARTIFACT** *(PO A. Maier)*
A group contains items and groups of one kind of artifact only.
*Check:* `tests/test_groups.py`

**AN ITEM HAS ONE PLACE IN ITS HIERARCHY** *(PO A. Maier)*
Every item appears exactly once in the hierarchy of its kind, either in one group or at the top
level.
*Check:* `tests/test_groups.py`

**EVERY HIERARCHY IS KEPT IN A GROUP FILE OF ITS OWN** *(PO A. Maier)*
The groups of each kind of artifact — requirements, use cases, architecture decisions, modules,
tests — are recorded in a file of their own under `docs/groups/` of the product repository, which
names each member by its identifier.
*Check:* `tests/test_groups.py`

**REGROUPING LEAVES THE GROUPED FILE UNCHANGED** *(PO A. Maier)*
Moving a requirement, use case, architecture decision, module or test to another group changes no
byte of the SPEC or of the artifact's file.
*Check:* `tests/test_groups.py` — blob SHAs of `SPEC.md` and of all artifact files are equal before
and after a regrouping.

**AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL** *(PO A. Maier)*
An item that no group names is shown at the top level of its hierarchy.
*Check:* `tests/test_groups.py`

**THE BROWSER SHOWS ANY RELEASED VERSION** *(PO A. Maier)*
The specification browser shows a product's requirements as they stand at any released version or
on the current default branch, as the reader chooses.
*Check:* `tests/trace-pages-specification.test.mjs`

**A REQUIREMENT SHOWS WHAT TRACES TO IT** *(PO A. Maier)*
For each requirement, the browser lists its sources and every use case, architecture element, module
and test that names it, as derived from the version shown.
*Check:* `tests/trace-graph-guards.test.mjs`, `tests/trace-graph-facts.test.mjs`, `tests/trace-pages-specification.test.mjs`

**OPEN PROPOSALS ARE SHOWN IN THE BROWSER** *(PO A. Maier)*
Every requirement that an open queue entry would add, change or withdraw is shown in the browser
with that entry's status and a link to it.
*Check:* `tests/trace-pages-specification.test.mjs`

**A REQUIREMENT SHOWS ITS HISTORY** *(PO A. Maier)*
For each requirement, the browser lists every accepted change to its text with date, accepting
person, and the text before and after.
*Check:* `tests/trace-pages-specification.test.mjs`

**A REGROUPING IS COMMITTED DIRECTLY** *(PO A. Maier)*
A change to a group file is the person's own input and is committed to the default branch when they
save it.
*Check:* `tests/test_groups.py`
## 2. Requirement sources

**THE SOURCE MODEL IS GENERIC** *(PO A. Maier)*
A requirement source is a typed record with an identifier, a kind, and an authority; no particular
organisation, standard or system is built into Agent M.
*Check:* `tests/test_source_model.py` — no source identifier appears in Agent M's own code.

**A REQUIREMENT HAS A REGISTERED SOURCE** *(PO A. Maier)*
Every requirement names at least one source linked to its product; a requirement without one cannot
be accepted.
*Check:* `tests/test_requirement_has_source.py`

**THE PERSON WHO PROMPTS IS A SOURCE** *(PO A. Maier)*
A requirement that a participant drafts from a person's instruction names that person's registered source among its
sources.
*Check:* `tests/test_prompted_source.py` — drafts a change of a requirement by prompt with a fixture participant, for a
person whose source the fixture product registers and links, and composes the sections the change would save. It checks
that every drafted requirement names that person's source among its sources.

**A SOURCE DECLARES ITS AUTHORITY** *(PO A. Maier)*
A source declares whether it is `normative`, `advisory` or `informational`; the declaration is
made at the source, not inferred from how often it is cited.
*Check:* `tests/test_source_authority.py`

**A LIVING SOURCE IS PINNED** *(PO A. Maier)*
A source that is maintained elsewhere records the exact state that was read — a commit, a version,
or a retrieval date — and a requirement derived from it names that state.
*Check:* `tests/test_source_pinned.py`

**THE SOURCE KIND IS ONE OF A CLOSED SET** *(PO A. Maier)*
A source has exactly one kind from: `organisation`, `person`, `standard`, `regulation`,
`document`, `system`, `measurement`.
*Check:* `tests/test_source_kind.py`

**THE INSTANCE KEEPS THE SOURCE REGISTER** *(PO A. Maier)*
An instance lists every requirement source it knows in `docs/sources/` of its own repository, one
file per source.
*Check:* `tests/test_source_register.py`

**A PRODUCT LINKS THE SOURCES THAT APPLY** *(PO A. Maier)*
A product names the sources that apply to it in `docs/sources.md` of its own repository, each with
the exact version it uses.
*Check:* `tests/test_source_links.py`

**A LINK NAMES THE PART THAT APPLIES** *(PO A. Maier)*
A link may name the part of a source that applies to the product — a safety class, a chapter, a set
of articles.
*Check:* `tests/test_source_links.py`

**A SOURCE IS FILES, AN ARCHIVE OR A REPOSITORY** *(PO A. Maier)*
The content of a source is a set of files (PDF, Word, Markdown), a zip archive of such files, or a
repository at a named commit.
*Check:* `tests/test_source_register.py`

**A SOURCE DECLARES ITS LICENCE** *(PO A. Maier)*
Every source records the licence or terms under which its content may be copied.
*Check:* `tests/test_source_register.py`

**RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE** *(PO A. Maier)*
The content of a source is stored in the instance repository only if its licence permits public
redistribution; otherwise it stays in a repository the person names, public or private.
*Check:* `tests/test_source_register.py`

**A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH** *(PO A. Maier)*
Every version of a source records its official identifier or edition, its date, and the SHA-256 of
every file that was read.
*Check:* `tests/test_source_register.py`

**A SOURCE VERSION IS NEVER OVERWRITTEN** *(PO A. Maier)*
A new edition of a source is added as a new version, and existing versions stay unchanged.
*Check:* `tests/test_source_register.py`

**A STANDARD IS REGISTERED BY ITS DESIGNATION** *(PO A. Maier)*
A standard is registered by its full designation, including edition and amendments — for example
`IEC 62304:2006+AMD1:2015`.
*Check:* `tests/test_source_register.py`

**AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY** *(PO A. Maier)*
An EU legal text is registered from its EUR-Lex or ELI address, and a workflow of the instance
fetches it from the EU's publication repository, recording the retrieval date and the repository's
version identifier.
*Check:* `tests/test_fetch_legal_text.py`
## 3. Requirements

**A REQUIREMENT HAS FOUR FIELDS** *(PO A. Maier)*
A requirement consists of a name, a source, a rule, and a check.
*Check:* `tests/test_requirement_fields.py`

**ONE STATEMENT PER REQUIREMENT** *(PO A. Maier)*
The rule of a requirement is a single statement; a rule containing "and" or "additionally" is two
requirements.
*Check:* `tests/test_single_statement.py` — flags conjunctions in the rule field for review; the
decision stays human.

**A RULE IS CHECKABLE** *(PO A. Maier)*
A rule is stated so that it can be shown to hold or not hold.
*Check:* no automatic check; at review.

**NO STATE IN THE SPECIFICATION** *(PO A. Maier)*
A requirement states the target, never the current condition of a system.
*Check:* no automatic check; at review.

**A REQUIREMENT NAMES ITS CHECK** *(PO A. Maier)*
Every requirement names the test that guards it, or states explicitly that it is guarded only at
review.
*Check:* `tests/test_requirement_names_check.py`

**A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST** *(PO A. Maier)*
Before an existing requirement is changed, the artifacts that reference it are listed, and the
list is part of the proposal rather than a result reported afterwards.
*Check:* `tests/test_impact_list.py` — a change proposal touching an existing identifier carries
the derived reference list.

**A REQUIREMENT NAMES WHAT IT CONSTRAINS** *(PO A. Maier)*
Where a requirement stands names what it constrains: a requirement of Agent M's SPEC constrains the development process,
a requirement of a product's SPEC constrains the product.
*Check:* `tests/test_products_folder.py` — no committed file of the instance repository, its SPEC included, names a product.

**DERIVATION SEES THE EXISTING REQUIREMENTS** *(PO A. Maier)*
When requirements are derived, every requirement of the product — in its SPEC and in its open change
queues — is part of the input the deriving participant receives.
*Check:* `tests/test_derivation_context.py`

**NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY** *(PO A. Maier)*
If the existing requirements do not fit into the deriving participant's context, the run stops and
says so before anything is sent.
*Check:* `tests/test_derivation_context.py`

**A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT** *(PO A. Maier)*
Every derived candidate is classified as a new requirement, a change to a named existing requirement,
a duplicate of one, or a conflict with one.
*Check:* `tests/test_derivation_classes.py`

**EXACT DUPLICATES ARE FOUND WITHOUT A MODEL** *(PO A. Maier)*
A candidate whose name or normalised rule text equals an existing requirement's is classified as a
duplicate deterministically, before any model classification.
*Check:* `tests/test_derivation_classes.py`

**THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED** *(PO A. Maier)*
How often the model classifies a candidate correctly is measured as a rate on a fixed set of
examples, and every classification is shown to a person, who can change it.
*Check:* `tests/test_derivation_classes.py` — the rate is reported, not gated.

**A CHANGE IS PROPOSED UNDER THE EXISTING NAME** *(PO A. Maier)*
A candidate that changes an existing requirement is proposed as a change to that requirement, under
its name, with its current text beside it and its impact list.
*Check:* `tests/test_derivation_classes.py`

**A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT** *(PO A. Maier)*
A candidate that restates an existing requirement is proposed as an additional source of that
requirement, never as a new requirement.
*Check:* `tests/test_derivation_classes.py`

**A CONFLICT IS DECIDED BY A PERSON** *(PO A. Maier)*
A candidate that contradicts an existing requirement is shown beside it, with both sources and their
authority, and is neither applied nor dropped until a person decides.
*Check:* `tests/test_derivation_classes.py`

**CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES** *(PO A. Maier)*
Candidates of one run that state the same rule are merged into one candidate, naming every passage
they came from, before they are compared with the existing requirements.
*Check:* `tests/test_derivation_classes.py`
## 4. Use cases and models

**A USE CASE REALISES NAMED REQUIREMENTS** *(PO A. Maier)*
Every use case names the requirement identifiers it realises.
*Check:* `tests/test_usecase_realises.py`

**A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION** *(Vibe Coding, ch. 9 §2.1)*
A use-case description names its actor, its precondition, its main flow, its alternative flows,
and its postcondition.
*Check:* `tests/test_usecase_fields.py`

**DIAGRAMS ARE MERMAID IN MARKDOWN** *(Vibe Coding, ch. 9 §6)*
Every diagram is written as Mermaid inside the Markdown document it belongs to; no diagram is
stored as an image file.
*Check:* `tests/test_diagrams_are_mermaid.py`

**THE PROSE IS AUTHORITATIVE, THE DIAGRAM IS THE OVERVIEW** *(PO A. Maier)*
Where a diagram and its use-case description disagree, the description holds.
*Check:* no automatic check; at review.

**UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN** *(PO A. Maier)*
A requirement with no use case and a use case with no requirement are both shown in the dashboard;
neither blocks a run.
*Check:* `tests/test_coverage_report.py`
## 5. Process models and practices

**THE PROCESS MODEL IS DECLARED PER PRODUCT** *(PO A. Maier)*
Each managed product declares exactly one process model before its implementation starts; Agent M does not assume a
default.
*Check:* `tests/test_model_declared.py`

**THE CATALOGUE IS DATA** *(PO A. Maier)*
Process models and practices are declarative definitions in data files, not code paths; adding one
requires no change to Agent M's implementation.
*Check:* `tests/test_catalogue_is_data.py` — no model or practice name appears in Agent M's
implementation.

**THE MODEL DETERMINES THE PHASES AND THE GATES** *(Vibe Coding, ch. 6–7; PO A. Maier)*
A model definition names its phases, the transitions between them, which phases pair for
verification, and where the gates sit; Agent M derives the workflow from that definition together with the product's process
requirements.
*Check:* `tests/test_workflow_from_model.py` — each of the five catalogue models, the reuse-oriented
one included, yields its workflow.

**AGENT M CARRIES THE BOOK'S CATALOGUE** *(Vibe Coding, ch. 6–7, 14)*
The shipped catalogue contains the book's process models — waterfall, V-model, reuse-oriented, Scrum
and Kanban — and, separately, its practices: DevOps, prototyping, incremental delivery, and the
scaling layers of disciplined agile delivery.
*Check:* `tests/test_catalogue_complete.py`

**A PROCESS REQUIREMENT ADDS TO THE MODEL** *(PO A. Maier)*
A requirement that constrains the development process adds artifacts or gates to the declared
process model and never replaces the model.
*Check:* `tests/test_process_requirement_is_additive.py`

**A PROCESS MODEL ORGANISES PEOPLE AND AGENTS** *(PO A. Maier)*
A process model names the roles of the work and, for each role, whether a person, an agent, or
either may fill it.
*Check:* `tests/test_model_roles.py`

**A ROLE NAMES HOW MANY FILL IT** *(PO A. Maier)*
A process model names for each role whether it is filled by one participant or may be filled by several.
*Check:* `tests/test_model_roles.py` — validates every shipped and instance model definition against the model schema.
It checks that each role states how many participants fill it.

**A PRACTICE IS NOT A MODEL** *(PO A. Maier)*
A practice — DevOps, prototyping, incremental delivery, a scaling layer — is added to a declared
process model and is never chosen instead of one.
*Check:* `tests/test_model_declared.py`

**A GATE NAMES WHAT IT CHECKS** *(PO A. Maier)*
Every gate in a model definition names the artifacts that must exist and the condition that must
hold before the next phase opens.
*Check:* `tests/test_gate_definition.py`

**PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE** *(PO A. Maier)*
An instance lists all its participants — people and agents — in the one list `docs/participants.md` of its own
repository, and a product assigns its roles from that list.
*Check:* `tests/test_participants.py` — scans the instance repository for participant lists and resolves every name in
the product's role assignments against `docs/participants.md`. It checks that this is the instance's only participant
list and that it holds every assigned name.

**A PARTICIPANT HAS ONE OF FIVE TYPES** *(PO A. Maier)*
A participant is a person, a model endpoint, a CI agent, a CLI agent on a machine, or a sandboxed
agent in a virtual machine or container.
*Check:* `tests/test_participants.py`

**A PARTICIPANT DECLARES ITS CAPABILITIES** *(PO A. Maier)*
Each participant states which of these it can do: draft text, read the repository, write to the
repository, run code and tests, use tools, reach the web.
*Check:* `tests/test_participants.py`

**A ROLE NAMES THE CAPABILITIES IT NEEDS** *(PO A. Maier)*
A role in a process model names the capabilities its holder must have, and only a participant with
all of them can be assigned to it.
*Check:* `tests/test_model_roles.py`

**A PARTICIPANT DECLARES WHERE IT PROCESSES DATA** *(PO A. Maier)*
Each participant that is not a person states where the data given to it is processed — for example
"this machine", "NHR@FAU, Erlangen", "a provider in the USA".
*Check:* `tests/test_participants.py`

**A PARTICIPANT BASED ON A LANGUAGE MODEL NAMES ITS MODEL** *(PO A. Maier)*
Each participant that works with a language model — a model endpoint, a CI agent, a CLI agent or a
sandboxed agent — names the model it uses.
*Check:* `tests/test_participants.py` — a CLI-agent entry without a model is rejected; counter-proof: the
same entry naming its model is accepted, and a person needs none.

**THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE** *(PO A. Maier)*
A model endpoint or a CLI session that the prompt bar offers from the browser's configuration declares its capabilities,
the place where it processes data and its model, and counts as a participant for every rule of this specification,
except that it is not listed in the instance's participant list and holds no role.
*Check:* `tests/prompt-bar-endpoints.test.mjs` — an endpoint or CLI session without a place or a model is not offered,
the page names each with its place before a message is sent, a page of mail gives a CLI session the mail's `MAIL-`
identifier only, and a restricted source's content is refused to an endpoint whose place its entry does not permit;
counter-proof: the same endpoint at a permitted place receives it, and with recording off a conversation with an
endpoint writes nothing to a repository.

**RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS** *(PO A. Maier)*
Content of a source whose licence is restricted is given only to participants whose processing place
the source's register entry permits.
*Check:* `tests/review-core.test.mjs`

**THE PROCESS NAMES ROLES, NOT PARTICIPANTS** *(PO A. Maier)*
A product's process declaration names the roles that participants fill, never a participant.
*Check:* `tests/test_role_assignment.py` — compares the product's process declaration with the instance's participant
list. It checks that the declaration names no participant.

**A ROLE ASSIGNMENT FILLS THE ROLES** *(PO A. Maier)*
A product's roles are filled in a role assignment, a file `docs/role-assignments/<name>.md` of the product's repository
that only assigns participants to the roles of its process.
*Check:* `tests/test_role_assignment.py` — validates each role assignment against the roles of the product's process. It
checks that the assignment gives participants to those roles and holds nothing else.

**A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM** *(PO A. Maier)*
A product has one role assignment, or, in a model that works in sprints, one for each of its teams.
*Check:* `tests/test_role_assignment.py` — compares the number of a product's role assignments with its teams and with
whether its model works in sprints. It checks for one assignment per product, or one per team.

**A PARTICIPANT MAY SERVE SEVERAL TEAMS** *(PO A. Maier)*
A participant may hold roles in several teams of a product at the same time.
*Check:* `tests/test_role_assignment.py` — validates the role assignments of a product's teams together. It checks that
a participant may hold roles in several of them.
## 6. Runtimes

**ONE DEFINITION, THREE DRIVERS** *(PO A. Maier)*
The prompts, schemas and job definitions exist exactly once, as data in the repository; the
browser, the GitHub Actions workflow and the local bridge are drivers over that one definition.
*Check:* `tests/test_single_definition.py` — no prompt or schema text appears in more than one
place.

**A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY** *(PO A. Maier)*
A self-hosted runner that runs Agent M jobs is registered only to a repository whose visibility is
private, and Agent M starts no job on a runner of a public repository.
*Check:* `tests/review-core.test.mjs` — starting a job on a runner of a repository the API reports as
public is refused; counter-proof: a private one is allowed.

**A RUNTIME IS INTERCHANGEABLE** *(PO A. Maier)*
The same job, given the same inputs, produces the same kind of artifact in all three runtimes.
*Check:* `tests/test_runtime_parity.py`

**THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY** *(PO A. Maier)*
The local bridge accepts a bind address of `127.0.0.1`, `::1` or `localhost` and refuses any other.
*Check:* `tests/test_bridge_loopback.py`

**REMOTE ACCESS TO THE BRIDGE GOES THROUGH A TUNNEL** *(PO A. Maier)*
Remote work reaches the local bridge only through an authenticated tunnel or port forward, such as
SSH, that ends on the bridge's loopback address.
*Check:* `tests/test_bridge_tunnel.py` — the bridge answers through a forwarded loopback port and
on no non-loopback interface.

**A BRIDGE BEHIND NAT IS REACHED THROUGH A REVERSE TUNNEL** *(PO A. Maier)*
A bridge on a machine that accepts no incoming connection is reached through an SSH reverse tunnel that
this machine opens to a jump host the person names, and through a forward from the person's own machine
to that jump host.
*Check:* `tests/test_bridge_tunnel.py` — through a reverse and a forward tunnel over a test SSH server,
the dashboard's request reaches the bridge; counter-proof: without the forward, nothing answers.

**A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK** *(PO A. Maier)*
The port a reverse tunnel opens on the jump host is bound to the jump host's loopback address only.
*Check:* `tests/test_bridge_tunnel.py` — the generated reverse-tunnel command names the loopback address;
counter-proof: a command with `0.0.0.0` or an empty bind address fails.

**A BRIDGE CAN BE REACHED OVER HTTPS THROUGH THE JUMP HOST** *(PO A. Maier)*
The dashboard can reach a bridge through an HTTPS address of the jump host, served with a certificate the
browsers trust, whose web server forwards the requests to the end of the bridge's reverse tunnel on the
jump host's loopback.
*Check:* `tests/test_bridge_tunnel.py` — through a test HTTPS proxy in front of a reverse tunnel, the
dashboard's request reaches the bridge; counter-proofs: with the tunnel closed, the proxy answers with an
error and no bridge is reached; behind a certificate the test browser does not trust, the request fails and
the settings page names the certificate as a possible cause.

**THE JUMP HOST FORWARDS TO A BRIDGE ONLY AFTER ITS OWN LOGIN** *(PO A. Maier)*
The jump host's web server forwards a request to a bridge's tunnel only when the request carries the web
server's own login over TLS.
*Check:* `tests/test_bridge_tunnel.py` — a request without the login is answered `401` and reaches no
bridge; counter-proof: with the login and the bridge's token it is answered by the bridge.

**THE JUMP HOST ALLOWS CROSS-ORIGIN REQUESTS ONLY FROM THE INSTANCE** *(PO A. Maier)*
The jump host's web server allows cross-origin requests to a bridge only from the instance's Pages origin.
*Check:* `tests/test_bridge_tunnel.py` — a preflight from the Pages origin is allowed; counter-proof: one
from any other origin is refused.

**EACH REMOTE SESSION HAS ITS OWN PORT FROM THE CONFIGURED RANGE** *(PO A. Maier)*
Each CLI session reached through the jump host is given one port from the jump host's configured port
range, and no two sessions share a port.
*Check:* `tests/review-core.test.mjs` — a new session gets the lowest free port of the range; a range
with no free port refuses a new session and says so.

**THE DASHBOARD WRITES THE TUNNEL COMMANDS** *(PO A. Maier)*
For each remote session, the dashboard shows the complete commands for both ends of its tunnel, filled
in from the settings.
*Check:* `tests/review-core.test.mjs`

**THE LOCAL BRIDGE REQUIRES A TOKEN** *(PO A. Maier)*
The bridge rejects any request that does not carry the token it was paired with.
*Check:* `tests/test_bridge_token.py`

**THE BRIDGE IS PAIRED ONCE** *(PO A. Maier)*
The bridge keeps its token across restarts, in a file outside every repository that only its user can
read, until the person pairs it anew.
*Check:* `tests/test_bridge_token.py` — after a restart the stored token is accepted and the file is
readable by its owner only; counter-proof: after *pair anew* the old token is rejected.

**AN UNSUPPORTED ENDPOINT SAYS SO** *(PO A. Maier)*
When a configured endpoint cannot be called from the browser, Agent M names the reason and the
runtimes that would work instead; it does not report a generic failure.
*Check:* `tests/test_endpoint_diagnosis.py`

**BROWSER REACHABILITY IS MEASURED, NOT ASSUMED** *(PO A. Maier)*
Before a runtime is released, the browser behaviour it depends on is measured on current browsers
and the result is recorded in `docs/measurements/`.
*Check:* `tests/test_measurement_present.py` — a released runtime has a dated measurement file.

**AGENT M WORKS WITHOUT A LOCAL INSTALLATION** *(PO A. Maier)*
Every job that needs no resource on the person's own network can run with nothing installed on the
person's computer — in the browser, or in the product's CI on the server's own machines.
*Check:* `tests/test_runtime_levels.py` — every job kind whose definition names no local resource is
runnable on the hosted-CI route; counter-proof: a job needing a compute resource is not offered there.

**A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET** *(PO A. Maier)*
A job on the server's own machines authenticates its coding agent with a key stored as a CI secret of the
repository, which the dashboard names and whose settings page it opens, and never asks for. The runner machine the
agent works on receives only the key of the participant the job names; no other secret of the repository reaches it.
*Check:* `tests/test_runtime_levels.py` — the generated job workflow reads the key only from the named
secret, and the part of it that runs the agent reads no other secret; counter-proof: a workflow with the key written
into it, or one whose agent part reads `AGENT_M_TOKEN` or another participant's key, fails.

**THE BRIDGE IS ONE FILE PER PLATFORM** *(PO A. Maier)*
The local bridge is delivered as one file for each of Windows on x86-64, macOS and Linux — an executable,
a disk image or an installer —, and needs no other runtime installed.
*Check:* `tests/test_bridge_release.py` — the release build yields one file per platform, and each starts,
after installation where it is an installer, on a machine without Node or Deno.

**THE BRIDGE IS BUILT FROM THE DASHBOARD'S CODE** *(PO A. Maier)*
The bridge is compiled from the same JavaScript modules and job definitions the dashboard uses.
*Check:* `tests/test_single_definition.py` — the bridge's build imports the dashboard's modules; no job
definition exists twice.

**THE BRIDGE IS SIGNED BY ITS PUBLISHER** *(PO A. Maier)*
Every released bridge file is signed by the publisher of the Agent M release — for macOS with an Apple
Developer ID and notarised, for Windows with a code-signing certificate.
*Check:* `tests/test_bridge_release.py` — the release refuses to publish a file whose signature or
notarisation cannot be verified.

**THE BRIDGE RUNS AS AN APP** *(PO A. Maier)*
The bridge is started by a double click and runs with an icon in the menu bar or the system tray — or,
where the system shows no tray icon, with its window open —, from which it is paused, quit and opened; it
needs no command line.
*Check:* no automatic check; at review.

**THE BRIDGE SHOWS ITS PAIRING TOKEN IN ITS WINDOW** *(PO A. Maier)*
The bridge shows the token it is paired with in its own window, with a button that copies it.
*Check:* no automatic check; at review.

**THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT** *(PO A. Maier)*
A bridge's own settings — its name, its jump host, its port, its pairing token, the working folder of each agent it
offers — are set in its window or read from a settings file exported by the dashboard.
*Check:* `tests/test_bridge_settings.py` — sets each of these settings in the bridge's window and imports a fixture
settings export of the dashboard. It checks that every setting is kept as it was set, and that the part the export holds
is taken from the file.

**THE BRIDGE FINDS THE INSTALLED AGENTS** *(PO A. Maier)*
The bridge lists each supported coding-agent CLI that is installed on its machine, with its version, and
offers as participants only those of them the person has chosen in its window.
*Check:* `tests/test_bridge_agents.py` — puts fixture executables of supported agents on the path and chooses some of
them in the bridge's settings. It checks that exactly the installed ones are listed, and that only the chosen ones are
offered.

**THE BRIDGE GUIDES THE INSTALLATION OF A MISSING AGENT** *(PO A. Maier)*
For a supported agent that is not installed, the bridge shows the vendor's installation instructions for
its platform and checks again when the person says it is done.
*Check:* no automatic check; at review.

**A LOCAL AGENT USES THE PERSON'S OWN LOGIN** *(PO A. Maier)*
The bridge runs a coding agent with the login that agent already has on the machine; Agent M asks for no
key for it.
*Check:* `tests/test_bridge_agents.py` — the command the bridge starts carries no key and no key
environment variable.

**THE BRIDGE OPENS ITS TUNNELS ITSELF** *(PO A. Maier)*
A bridge whose settings name a jump host opens the SSH connection they call for — the reverse tunnel on the
machine behind NAT, the forward on the person's machine — and keeps it open; the person types no SSH
command.
*Check:* `tests/test_bridge_tunnel.py` — two bridges and a test SSH server: the dashboard's request reaches
the far bridge without any command typed; counter-proof: with the far bridge's tunnel closed, nothing
answers.

**THE BRIDGE CREATES ITS OWN SSH KEY** *(PO A. Maier)*
A bridge that opens tunnels creates its own SSH key pair on first use, keeps the private key on its machine
only, and shows the public key to be added on the jump host.
*Check:* `tests/test_bridge_tunnel.py` — the private key file is readable by its owner only and appears in
no export; counter-proof: an export containing it fails the test.

**THE BRIDGE IS UPDATED ONLY BY THE PERSON'S CHOICE** *(PO A. Maier)*
The bridge offers a newer release and installs it only after the person's click, and only when its
signature is valid.
*Check:* `tests/test_bridge_release.py` — an update with an invalid signature is refused; counter-proof: a
valid one is installed after the click.
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
## 8. Versioning

**CALENDAR VERSIONS** *(PO A. Maier)*
Agent M and every product built with it use calendar versioning in the form `YYYY.MINOR.PATCH`.
*Check:* `tests/test_version_format.py`

**EVERY PRODUCT HAS ITS OWN VERSION LINE** *(PO A. Maier)*
One Agent M instance manages several products in parallel; each product's version is independent
of Agent M's and of every other product's.
*Check:* `tests/test_version_independence.py`

**A RELEASE IS TAGGED AND LOGGED** *(PO A. Maier)*
A release raises the version, adds a dated entry to the changelog, and sets the git tag
`vYYYY.MINOR.PATCH`.
*Check:* `tests/test_release_artifacts.py`

**AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT** *(PO A. Maier)*
The commit that writes a generated artifact names the Agent M version, the participant and the model that
produced it.
*Check:* `tests/test_artifact_provenance.py` — the commit names them, and the artifact's own text names none of
them.

**A VERSION IS NOT REWRITTEN** *(PO A. Maier)*
A released version is never re-tagged or overwritten; a correction is a new version.
*Check:* `tests/test_tags_immutable.py`
## 9. Human gates

**A GENERATED ARTIFACT IS A PROPOSAL** *(PO A. Maier)*
Everything Agent M generates counts as a proposal until a person accepts it.
*Check:* `tests/review-core.test.mjs` — a file without an approval record naming its current text
is shown as open.

**A RECORD IS EVIDENCE, NOT A PROPOSAL** *(PO A. Maier)*
Approval records, gate records, job records, test result records and conversation records are written once as evidence
of what happened and are never shown for acceptance.
*Check:* `tests/review-core.test.mjs` — a job record without approval is not listed as open;
counter-proof: a use case without approval is.

**A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN** *(PO A. Maier)*
A use case, an architecture decision or a SPEC change proposal may be written directly to the default branch,
where it counts as open until an approval record names its text, or, for a SPEC change entry, until its queue's
decision row names the commit that wrote it into the SPEC.
*Check:* `tests/review-core.test.mjs`

**CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI** *(PO A. Maier)*
A change to code, tests, workflows or the dashboard reaches the default branch only through a pull
request whose CI run is green.
*Check:* no automatic check; at review. The repository's branch protection can enforce it.

**A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN** *(PO A. Maier)*
A change to a product's specification is shown beside the text it would replace and is written
only after a person accepts it.
*Check:* `tests/test_spec_gate.py`

**THE APPROVED TEXT IS TAKEN VERBATIM** *(PO A. Maier)*
What stands in the approval field is exactly what is written to the specification; nothing
reformulates it afterwards.
*Check:* `tests/test_verbatim.py`

**NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT** *(PO A. Maier)*
A change is presented together with the specification text that currently holds, not as a summary
of it.
*Check:* `tests/test_proposal_shows_current.py`

**EVOLUTION ENTERS THROUGH THE SPECIFICATION** *(PO A. Maier)*
An issue that changes behaviour — on GitHub or on the product's GitLab server — becomes a
specification change first and a code change second.
*Check:* `tests/test_issue_to_spec.py`

**THE GATE IS RECORDED** *(PO A. Maier)*
Every passed gate records who decided, when, and on which text.
*Check:* `tests/test_gate_record.py`

**THE REPLACED TEXT STAYS REACHABLE** *(PO A. Maier)*
A replaced specification section remains reachable through the git history; no second copy is kept
in the working tree.
*Check:* `tests/test_replaced_in_history.py`

**A PERSON'S OWN INPUT IS COMMITTED DIRECTLY** *(PO A. Maier)*
What a person enters in Agent M themselves — a requirement source, a product, a release — is
committed to the default branch under their own account when they save it.
*Check:* `tests/review-core.test.mjs`

**ADDING A PRODUCT CREATES ITS LAYOUT** *(PO A. Maier)*
When a person adds a product, Agent M writes the missing review layout into the product's default
branch without a pull request.
*Check:* `tests/review-core.test.mjs`

**A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT** *(PO A. Maier)*
When a draft returned by a participant fails one of Agent M's checks, Agent M sends the draft and its
findings back to that participant and asks for a corrected draft before the person sees it.
*Check:* `tests/test_correction_loop.py` — a fixture participant that first returns an unknown name under
`realises` and then a corrected draft is asked once more and the person sees only the corrected draft;
counter-proof: with the loop switched off, the person sees the error.

**A FINDING READS LIKE A COMPILER MESSAGE** *(PO A. Maier)*
Every finding sent back names the artifact and line it concerns, its kind (*error* or *warning*), the
rule it violates by name, and the correction expected, in one fixed text form.
*Check:* `tests/test_correction_loop.py` — every finding of the fixture run matches the template.

**AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED** *(PO A. Maier)*
A draft leaves the loop only when it has no error and every warning is either fixed or answered with a
one-line justification.
*Check:* `tests/test_correction_loop.py` — a justified warning ends the loop; an unfixed error does not.

**WHAT A PERSON DECIDES IS NOT SENT BACK** *(PO A. Maier)*
A conflict with an existing requirement, and every other finding the SPEC leaves to a person, is shown to
the person and never sent back to the participant.
*Check:* `tests/test_correction_loop.py` — a conflict finding appears in no message to the participant.

**THE CORRECTION LOOP HAS A FIXED LIMIT** *(PO A. Maier)*
The loop ends after a number of rounds fixed before the first round, or earlier when a round leaves the
findings unchanged; a draft that still has findings is then shown to the person with them.
*Check:* `tests/test_correction_loop.py` — a participant that never fixes its error is asked exactly
*limit* times, or once more than a round without change, and the person sees the remaining finding.

**THE ROUNDS ARE COUNTED AND SHOWN** *(PO A. Maier)*
The number of correction rounds a draft needed, and the findings of each round, are shown with the draft
and recorded with it.
*Check:* `tests/test_correction_loop.py`
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
## 11. Architecture and implementation

**AN ARCHITECTURE IS THE ORGANISATION OF THE WHOLE SYSTEM** *(Vibe Coding, ch. 10 §1, after IEEE 1471)*
A product's architecture describes the fundamental organisation of its whole system: its components, their
relationships to each other and to the environment, and the principles guiding its design and evolution.
*Check:* no automatic check; at review.

**AN ARCHITECTURE STATES STRUCTURE, INTERACTION AND STRATEGY** *(Vibe Coding, ch. 10 §1)*
An architecture states the static decomposition of the system into its components, the dynamic interaction of those
components at runtime, and the overarching strategy that holds both together.
*Check:* no automatic check; at review.

**A SYSTEM IS DECOMPOSED INTO SUBSYSTEMS AND MODULES** *(PO A. Maier; Vibe Coding, ch. 10 §3)*
An architecture decomposes the product's system into subsystems, and each subsystem into modules.
*Check:* no automatic check; at review.

**A MODULE BELONGS TO ONE SUBSYSTEM** *(PO A. Maier)*
Every module belongs to exactly one subsystem.
*Check:* no automatic check; at review.

**AN ARCHITECTURE IS DOCUMENTED IN FOUR VIEWS** *(Vibe Coding, ch. 10 §2, after Kruchten's 4+1 view model)*
An architecture is documented in a logical view of its abstractions, a process view of its behaviour at runtime, a
development view of its modules and files, and a physical view of where each of its parts runs.
*Check:* no automatic check; at review.

**THE USE CASES ARE THE SCENARIOS OF THE ARCHITECTURE** *(Vibe Coding, ch. 10 §2, after Kruchten's 4+1 view model)*
Each accepted use case appears in the architecture as a scenario that names the subsystems taking part and how they
interact, which shows that the system makes the use case possible.
*Check:* no automatic check; at review.

**THE ARCHITECTURE DOES NOT RESTATE THE USE CASES** *(PO A. Maier)*
No use case is restated step by step in the architecture.
*Check:* no automatic check; at review.

**THE ARCHITECTURE IS CUT BY FUNCTION, NOT BY USE-CASE STEP** *(PO A. Maier)*
Subsystems and modules are cut by the functions and data the system needs to make its use cases possible, never by the
steps of the use cases.
*Check:* no automatic check; at review.

**AN ARCHITECTURE NAMES ITS PATTERNS** *(Vibe Coding, ch. 10 §4–§6)*
An architecture names the architectural patterns it combines — structuring patterns such as layers, pipe-and-filter or a
repository, adaptable-system patterns such as plug-ins, distributed-system patterns such as client-server, a broker or
service orientation — and, for each, the part of the system it organises and why it was chosen.
*Check:* no automatic check; at review.

**AN ARCHITECTURE STAYS AT THE LEVEL OF MODULES** *(PO A. Maier)*
An architecture describes the system down to its modules and their interfaces, and leaves every question that only an
implementation can answer to the implementation.
*Check:* no automatic check; at review.

**DIVIDE AND CONQUER** *(Vibe Coding, ch. 10 §3)*
A system is decomposed top-down into smaller, independent parts, each of which can be built and checked on its own.
*Check:* no automatic check; at review.

**DESIGN TO TEST** *(Vibe Coding, ch. 10 §3)*
An architecture states how the system, each subsystem and each module will be tested.
*Check:* no automatic check; at review.

**KEEP IT SIMPLE** *(Vibe Coding, ch. 10 §3)*
An architecture is the simplest design that meets the accepted requirements and use cases.
*Check:* no automatic check; at review.

**YOU AREN'T GONNA NEED IT** *(Vibe Coding, ch. 10 §3)*
An architecture designs nothing that the product will not actually need.
*Check:* no automatic check; at review.

**DON'T REPEAT YOURSELF** *(Vibe Coding, ch. 10 §3)*
An architecture defines each function, data structure and rule in one place.
*Check:* no automatic check; at review.

**LEAST ASTONISHMENT** *(Vibe Coding, ch. 10 §3)*
Every interface behaves the way its users expect from its name and its description.
*Check:* no automatic check; at review.

**OPEN FOR EXTENSION, CLOSED FOR CHANGE** *(Vibe Coding, ch. 10 §3)*
A module can be extended with new functions without changing the functions it already offers.
*Check:* no automatic check; at review.

**DEVELOP AGAINST INTERFACES** *(Vibe Coding, ch. 10 §3)*
A module uses another module only through that module's interface, never through its implementation.
*Check:* no automatic check; at review.

**AN INTERFACE TELLS ITS USER WHAT TO CONSIDER** *(Vibe Coding, ch. 10 §3)*
The definition of an interface states everything its user must consider to use it.
*Check:* no automatic check; at review.

**AN INTERFACE HIDES ITS IMPLEMENTATION** *(Vibe Coding, ch. 10 §6)*
An interface exposes functions and data structures and hides how they are implemented.
*Check:* no automatic check; at review.

**A REMOTE INTERFACE NAMES HOW IT FAILS** *(Vibe Coding, ch. 10 §6)*
An interface whose calls cross a network states that they do, and how a call fails when the network or the other side
is unavailable.
*Check:* no automatic check; at review.

**A MODULE INTERFACE IS MINIMAL** *(PO A. Maier)*
A module's interface offers only the functions that other modules need.
*Check:* no automatic check; at review.

**MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE** *(PO A. Maier)*
The modules an architecture designs use each other's interfaces without a cycle.
*Check:* no automatic check; at review.

**ONE ARCHITECTURE DECISION, ONE FILE** *(PO A. Maier)*
Each architecture decision is a single Markdown file named
`docs/architecture/ARC-<nnn>-<slug>.md` in the product repository.
*Check:* `tests/test_architecture_files.py`

**AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES** *(PO A. Maier; Vibe Coding, ch. 10 §2)*
An architecture decision names the situation that calls for it, the decision taken, the alternatives
that were considered, and the consequences accepted with it.
*Check:* `tests/test_architecture_files.py`

**ONE DECISION STATES THE WHOLE ARCHITECTURE** *(PO A. Maier)*
One architecture decision of a product states its system as a whole — its patterns, its subsystems and their
relationships, its four views and its scenarios —, and every other decision of the product refines it.
*Check:* no automatic check; at review.

**ONE DECISION PER SUBSYSTEM** *(PO A. Maier)*
Each subsystem is stated in an architecture decision of its own, which names its responsibility within the system, the
interface it offers and its modules.
*Check:* no automatic check; at review.

**ONE MODULE, ONE FILE** *(PO A. Maier)*
Each module is described in a single Markdown file named `docs/architecture/MOD-<slug>.md` in the product repository.
*Check:* `tests/review-core.test.mjs` — the file `docs/architecture/MOD-<slug>.md` is reviewed as the module
`MOD-<slug>`.

**A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES** *(Vibe Coding, ch. 10 §3, ch. 12 §6; PO A. Maier)*
A module's file states the subsystem it belongs to, its single responsibility and what it implements — the parts it
consists of, the data it keeps, the interface it provides, the files it reads or writes and the interfaces of other
modules it uses —, so that a developer or an agent can implement the module from its file.
*Check:* no automatic check; at review.

**A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS** *(PO A. Maier)*
A module's file is written, reviewed, accepted and changed as an architecture decision is.
*Check:* `tests/review-core.test.mjs` — a module file without an approval record naming its text is shown as open;
counter-proof: with one, it is shown as accepted.

**A MODULE IS A FOLDER** *(PO A. Maier)*
Each module is one folder of its product's source code, named after its identifier `MOD-<slug>`.
*Check:* `tests/test_coverage_report.py` — a code file outside every module's folder is reported.

**AN INTERFACE STATES ITS TYPES** *(PO A. Maier)*
Every function of a module's interface states the type of each parameter and of its result, and the errors its caller
must handle.
*Check:* no automatic check; at review.

**A DATA FORMAT IS DEFINED ONCE** *(PO A. Maier)*
Every data structure and file format that crosses a module boundary is defined once, in the file of the module that
owns it.
*Check:* no automatic check; at review.

**ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES** *(PO A. Maier)*
An architecture is drafted or changed only against use cases whose current text an approval record names.
*Check:* `tests/test_job_preconditions.py` — a job that drafts an architecture against an open use case does not start
and names that use case; counter-proof: once an approval record names its text, the job starts.

**THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE** *(PO A. Maier)*
A product's first architecture is drafted in one piece, for every requirement of its SPEC and every one of its use cases.
*Check:* `tests/test_derivation_context.py` — the first derivation for a fixture product offers no selection and sends
every requirement and every use case; counter-proof: a derivation of part of them is refused.

**AN ARCHITECTURE IS DERIVED FROM THE WHOLE TO ITS MODULES** *(PO A. Maier; Vibe Coding, ch. 10 §3)*
An architecture is derived top-down: first the system's context, its patterns, its subsystems and the four views, then
the scenarios of the use cases, then the decisions of its subsystems, and only then the files of its modules.
*Check:* no automatic check; at review.

**THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT** *(PO A. Maier)*
A participant that drafts or checks an architecture receives the whole SPEC, every accepted use case and the whole
architecture.
*Check:* `tests/test_derivation_context.py` — the input sent to a fixture drafter and to a fixture reviewer contains
every requirement, every accepted use case and every file of the architecture.

**NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY** *(PO A. Maier)*
If the SPEC, the accepted use cases and the architecture do not fit into a participant's context, nothing is sent and
the dashboard says what does not fit.
*Check:* `tests/test_derivation_context.py`

**ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS** *(PO A. Maier)*
An architecture decision can be accepted only when every requirement and use case it names is
accepted.
*Check:* `tests/review-core.test.mjs`

**THE DERIVATION RULES HOLD FOR ARCHITECTURE** *(PO A. Maier)*
`DERIVATION SEES THE EXISTING REQUIREMENTS`, `NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY`,
`A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT`, `EXACT DUPLICATES ARE FOUND WITHOUT A MODEL`,
`THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED`, `A CHANGE IS PROPOSED UNDER THE EXISTING NAME`,
`A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT`, `A CONFLICT IS DECIDED BY A PERSON` and
`CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES` apply to the derivation of architecture decisions, with
"requirement" read as "architecture decision" and "source" read as "the requirement or use case that forces it".
*Check:* `tests/test_derivation_classes.py` — the same battery, with architecture fixtures.

**AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE** *(PO A. Maier)*
An architecture draft is checked only once it is complete, and then as a whole.
*Check:* `tests/test_architecture_review.py` — a fixture reviewer receives the complete draft; counter-proof: no review
starts for a draft that lacks the decision stating the whole architecture.

**A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE** *(PO A. Maier)*
A change to an architecture that concerns more than one module is checked together with the whole architecture.
*Check:* `tests/test_architecture_review.py` — a change to two module files sends every file of the architecture
to the reviewer.

**AN ARCHITECTURE IS CHECKED BY REVIEW, NOT BY TESTS** *(PO A. Maier)*
An architecture is checked by reviewing participants and by a person; no test or CI run checks it.
*Check:* no automatic check; at review.

**THE ARCHITECTURE IS REVIEWED AGAINST THE SPECIFICATION** *(PO A. Maier)*
A reviewing participant checks the whole architecture against the whole SPEC, the principles of this section included.
*Check:* no automatic check; at review.

**EVERY USE CASE IS CHECKED AGAINST THE ARCHITECTURE** *(PO A. Maier)*
A reviewing participant checks every accepted use case against the system, by whether its scenario is possible with the
subsystems and their interfaces.
*Check:* no automatic check; at review.

**A SUBSYSTEM IS CHECKED AGAINST THE SYSTEM** *(PO A. Maier)*
A reviewing participant checks every subsystem against the system, by whether it fulfils the responsibility and offers
the interface that the decision stating the system gives it.
*Check:* no automatic check; at review.

**A MODULE IS CHECKED AGAINST ITS SUBSYSTEM** *(PO A. Maier)*
A reviewing participant checks every module against its subsystem, by whether it fulfils the part of the subsystem's
responsibility and interface that the subsystem's decision gives it.
*Check:* no automatic check; at review.

**NO MODULE IS CHECKED AGAINST THE USE CASES** *(PO A. Maier)*
No module is checked against the use cases.
*Check:* no automatic check; at review.

**NO REVIEWER IS THE DRAFTER** *(PO A. Maier)*
The reviewing participant of an architecture draft is not the participant that drafted it and does not use its model.
*Check:* `tests/test_architecture_review.py` — a reviewer that is the drafter, or uses its model, is refused before
anything is sent; counter-proof: another participant with another model is accepted.

**A REVIEWER'S FINDING IS A WARNING** *(PO A. Maier)*
A finding of the reviewing participant of an architecture draft is a warning.
*Check:* `tests/test_correction_loop.py` — a reviewer's finding answered with a justification ends the loop;
counter-proof: an unanswered one does not.

**A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON** *(PO A. Maier)*
A finding of a reviewing participant changes nothing until it has been checked against the SPEC, the use cases and the
architecture; a finding that does not hold is answered with the reason it does not.
*Check:* no automatic check; at review.

**AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT** *(PO A. Maier)*
A drafted architecture runs, in the correction loop and before a person sees it, through the review of
`THE ARCHITECTURE IS REVIEWED AGAINST THE SPECIFICATION`.
*Check:* `tests/test_correction_loop.py` — a fixture reviewer's finding is sent back, and the person sees only the
corrected draft.

**A REUSE DECISION RECORDS ITS DUE DILIGENCE** *(Vibe Coding, ch. 6 §5)*
An architecture decision that adopts an external library, service or API records, for the chosen
candidate and for each alternative, its licence, its release history, how its issues are handled,
and its adoption.
*Check:* `tests/test_reuse_due_diligence.py`

**A PRODUCT DECLARES ITS LICENCE** *(PO A. Maier)*
Every managed product states its own licence in a `LICENSE` file at the root of its repository.
*Check:* `tests/test_reuse_due_diligence.py`

**A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S** *(PO A. Maier)*
The due diligence marks every candidate whose licence is not known to be compatible with the product's
licence.
*Check:* `tests/test_reuse_due_diligence.py` — a GPL-3.0 candidate for an MIT product is marked;
counter-proof: an MIT candidate is not.

**DUE DILIGENCE IS FETCHED, NOT RECALLED** *(PO A. Maier)*
Every fact in a due-diligence record is read from the candidate's package registry or source
repository and names the address and the date it was read.
*Check:* `tests/test_reuse_due_diligence.py` — a record with a fact lacking address or date fails;
counter-proof with a record whose package does not exist in the registry.

**AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST** *(PO A. Maier)*
Before a change to an accepted architecture decision is accepted, the modules it designs, their code files and
tests, and the requirements that reference it are shown beside the change.
*Check:* `tests/review-core.test.mjs`

**AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST** *(Vibe Coding, ch. 13 §5)*
The first commit of an implementation job that adds or changes behaviour contains only tests, and the
product's CI run on that commit is red.
*Check:* `tests/test_implementation_job.py` — reads the job branch's first commit and its CI result.

**A REFACTORING JOB BEGINS WITHOUT A FAILING TEST** *(PO A. Maier; Vibe Coding, ch. 13 §5)*
A job declared as refactoring starts without a failing test, and the product's CI run is green on
every one of its commits.
*Check:* `tests/test_implementation_job.py` — a refactoring job with a red run on any commit is
refused; counter-proof: green on every commit passes.

**A REFACTORING JOB CHANGES NO EXPECTED RESULT** *(PO A. Maier)*
A refactoring job changes the expected result of no test.
*Check:* `tests/test_implementation_job.py` — a refactoring pull request that changes an asserted
value fails; counter-proof: one that only moves a test passes.

**AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES** *(Vibe Coding, ch. 12 §6, ch. 10 §3; PO A. Maier)*
The pull request of an implementation job changes only code files in the folders of the modules the job was
given, tests that name one of those modules, and the files outside every module that one of those modules' files names
as taken over.
*Check:* `tests/test_implementation_job.py`

**EVERY CODE FILE BELONGS TO A MODULE** *(PO A. Maier)*
Every code file of a product lies in the folder of one module of its accepted architecture, or, where the platform that
runs it fixes its place — a CI workflow, a page the Pages site serves —, is named in the parts of one module; every test
and test helper names in its header a module of the architecture.
*Check:* `tests/test_coverage_report.py` — every code file in no module's folder and in no module's parts, and every
test or test helper that names no module of the architecture, is listed; counter-proof: a fixture product whose files
all belong to its modules lists none.

**CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT** *(PO A. Maier)*
A code file, test or test helper that belongs to no module is changed only by an implementation job of the module whose
file names it as taken over, which moves it into that module, or removes it once the module provides what it did,
together with the tests of what it removes.
*Check:* `tests/test_implementation_job.py` — a fixture job that moves a file its module's file names as taken over
passes, and one that removes such a file with the tests of what it removed passes; counter-proof: a job that changes
such a file in place, or one that no file of its modules names, is refused.

**MODULE GAPS ARE REPORTED, NOT FORBIDDEN** *(PO A. Maier)*
A module that realises no requirement, a requirement that no module realises, and a module that no test exercises
are shown in the dashboard; none of them blocks a job.
*Check:* `tests/test_coverage_report.py`
## 12. Tests and continuous integration

**EVERY TEST HAS ONE LEVEL** *(PO A. Maier; Vibe Coding, ch. 13 §4, §6, §7)*
Every test declares exactly one level from: `unit`, `component`, `system`, `release`, `user`.
*Check:* `tests/test_test_levels.py`

**A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS** *(PO A. Maier)*
Every test case names its input, its precondition and its expected result in a form that can be
read without running it.
*Check:* `tests/test_test_battery.py`

**A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT** *(PO A. Maier)*
A test that checks code never reads its expected result from the SPEC, a use case or an architecture file when it runs.
*Check:* `tests/test_expected_results_stated.py` — lists every test that names a module and reads `SPEC.md`, a file under
`docs/use-cases/` or a file under `docs/architecture/` when it runs, for review; the decision stays human. Counter-proof: a
fixture test that compares a function's result with a value read from a module file is listed; the same test stating
that value in its own text is not.

**TEST GENERATION SEES THE EXISTING TESTS** *(PO A. Maier)*
When tests are generated, every existing test of the product that guards the same requirements,
use cases or modules is part of the input the generating participant receives.
*Check:* `tests/test_test_generation_context.py`

**A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT** *(PO A. Maier)*
A new test is accepted only with a recorded counter-proof: a fault deliberately introduced into the
code it guards, and the test's failing result on it.
*Check:* `tests/test_counter_proof.py`

**A MODEL-DEPENDENT TEST IS MEASURED AS A RATE** *(PO A. Maier)*
A test whose outcome depends on a model's answer reports a pass rate over a number of runs fixed
before the first run, compared with the rate of the last release.
*Check:* `tests/test_rate_reporting.py`

**RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER** *(Vibe Coding, ch. 13 §4 and §6; ch. 12 §2)*
A test of level `release` is generated or written by a participant other than the one that
implemented the behaviour it tests.
*Check:* `tests/test_test_battery.py` — a release test whose recorded author equals the implementing
participant of its guarded use case fails.

**THE TEST SCHEDULE IS DECLARED PER PRODUCT** *(PO A. Maier)*
Agent M and every managed product declare, in a data file of their own repository, which test levels run on every commit,
on a pull request, nightly, on a release candidate, and on demand.
*Check:* `tests/test_ci_schedule.py`

**THE DEFAULT SCHEDULE FOLLOWS THE BOOK** *(Vibe Coding, ch. 12 §5; ch. 13 §4, §6, Exercises)*
Without a declaration, `unit`, `component` and `system` tests run on every commit and pull request,
tests calling a paid service run nightly, and every test runs on a release candidate.
*Check:* `tests/test_ci_schedule.py`

**COMMIT TESTS CALL NO PAID SERVICE** *(Vibe Coding, ch. 13 §4.1)*
A test that runs on every commit or pull request calls no external service that charges per call;
it uses a recorded or constructed response instead.
*Check:* `tests/test_ci_schedule.py` — a commit-level test that opens a connection to a configured
paid endpoint fails the run.

**A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES** *(PO A. Maier)*
Every job that the CI of Agent M's own repository runs on a pull request finishes within two minutes.
*Check:* `tests/test_ci_budget.py` — every job that `.github/workflows/agent-m-tests.yml` runs on a pull request carries a
limit of two minutes, after which GitHub stops it and the run fails; counter-proof: a job without that limit, or with a
longer one, fails.

**THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE** *(PO A. Maier)*
The CI configuration of Agent M and of every managed product — a GitHub Actions workflow on GitHub, a GitLab CI pipeline
on a GitLab server — is generated from its declared test schedule.
*Check:* `tests/test_ci_schedule.py` — the generated configuration triggers exactly the levels the
schedule names for each event.

**A JOB RECORD STARTS NO CI RUN** *(PO A. Maier)*
The generated CI configuration starts no run for a commit that changes only job records under
`docs/jobs/`.
*Check:* `tests/test_ci_schedule.py` — the generated configuration ignores a push touching only
`docs/jobs/`; counter-proof: a push also touching code starts a run.

**A RELEASE RUNS EVERY TEST AT EVERY LEVEL** *(PO A. Maier)*
A release is tagged only after every test of the product, at every level, has run on the release
candidate's commit.
*Check:* `tests/test_release_run.py`

**EVERY TEST RUN LEAVES A RESULT RECORD** *(PO A. Maier)*
Every test run leaves a record naming the commit, the levels run, the participant that ran it, the
date, and each test's outcome.
*Check:* `tests/test_result_records.py`

**A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY** *(PO A. Maier)*
A deterministic test with both a passing and a failing outcome recorded on the same commit is shown
as flaky, never as passed.
*Check:* `tests/review-core.test.mjs`

**THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON** *(PO A. Maier; Vibe Coding, ch. 13 §7)*
The report of a release run counts as accepted only when an approval record names its text.
*Check:* `tests/review-core.test.mjs`

**ACCEPTING THE RELEASE TEST REPORT RELEASES** *(PO A. Maier)*
Accepting a release test report on the dashboard also commits the changelog entry and sets the release
tag on the tested commit, as part of the same click.
*Check:* `tests/test_release_run.py` — after accepting a green report the tag exists on the tested
commit; counter-proof: rejecting it sets no tag.

**THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE** *(PO A. Maier)*
The audit view of a release lists every requirement valid at that release with the tests guarding
it, their outcomes on the release commit, and the acceptance of the release test report — including
requirements with no test or no passing outcome.
*Check:* `tests/test_audit_view.py`

**A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED** *(PO A. Maier)*
A release whose run has failing tests or worse rates is tagged only after a person accepts the
release test report with each failing test and the reason recorded in the approval.
*Check:* `tests/test_release_run.py` — a red run without a recorded limitation cannot be tagged;
counter-proof: with one it can.

**TEST RESULTS ARE KEPT IN THE REPOSITORY** *(PO A. Maier)*
Every result record is committed to the branch `test-results` of the product repository.
*Check:* `tests/test_result_records.py`

**A RESULT RECORD IS NEVER REWRITTEN** *(PO A. Maier)*
The branch `test-results` only grows: no record on it is changed or deleted, and it is never
force-pushed.
*Check:* `tests/test_result_records.py` — the branch's history is checked for rewritten or deleted
records; counter-proof with a fixture that amends one.
## 13. Process execution and jobs

**A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED** *(PO A. Maier)*
A process model definition can be declared for a product only after Agent M has validated it
without errors.
*Check:* `tests/test_model_validation.py`. Each rule has a definition that breaks it and must be
rejected: a transition naming a phase the model lacks, a verification pair naming a phase the model lacks, a gate
without artifacts or condition, a role without capabilities, a phase without a role, a missing
declaration of whether work is planned or pulled from a backlog. Each book model in the shipped
catalogue must pass.

**A PLAN COVERS THE WHOLE SPECIFICATION** *(PO A. Maier)*
In a model that plans its work in advance, the product's plan contains every accepted requirement
in every phase the model defines.
*Check:* `tests/test_plan_coverage.py`. For a fixture product with N accepted requirements and a
V-model definition of P phases, the derived plan has exactly N × P entries. Accepting one more
requirement adds P entries.

**A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN** *(PO A. Maier)*
In a model that plans its work in advance, an implementation job starts only for a step of the product's implementation
plan.
*Check:* `tests/test_job_preconditions.py` — in a V-model fixture, a job for work that no step of the plan names does not
start and says so; counter-proof: a job for a step of the plan starts.

**AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES** *(PO A. Maier; Vibe Coding, ch. 6)*
A product's implementation plan orders the modules of each subsystem by the interfaces they use, then the integration of
each subsystem, then the system.
*Check:* `tests/test_implementation_plan.py` — a drafted plan that leaves a module, a subsystem or the system without a step,
or orders a module before one whose interface it uses, is refused and the gap named; counter-proof: a plan in the order of
the interfaces is accepted.

**A PLAN STEP NAMES THE TESTS OF ITS LEVEL** *(PO A. Maier; Vibe Coding, ch. 6)*
Every step of an implementation plan names the tests of its level: unit tests for a module, component tests for a
subsystem, system and release tests for the system.
*Check:* `tests/test_implementation_plan.py` — a step without the tests of its level, or with tests of another level, is
refused; counter-proof: a step naming the tests of its level is accepted.

**THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY** *(PO A. Maier)*
A product's implementation plan is kept as Markdown under `docs/plan/` of the product's own repository.
*Check:* `tests/test_plan_layout.py` — a fixture product's plan is read from `docs/plan/`; counter-proof: a plan written
anywhere else is not found.

**AGILE IMPLEMENTATION STARTS FROM THE BACKLOG** *(PO A. Maier)*
In a model that pulls its work from a backlog, every implementation job implements one item of the
product's backlog.
*Check:* `tests/test_job_from_backlog.py`. Starting an implementation job without an item is refused
for a Scrum and a Kanban fixture.

**THE BACKLOG LIVES IN THE PRODUCT REPOSITORY** *(PO A. Maier)*
A product's backlog is kept as Markdown under `docs/backlog/` of the product's own repository.
*Check:* `tests/test_backlog_layout.py`

**A BACKLOG ITEM NAMES WHAT IT REALISES** *(PO A. Maier)*
Every backlog item names at least one requirement or use case that it realises.
*Check:* `tests/test_backlog_item_fields.py`

**A BACKLOG ITEM NAMES THE MODULES IT CHANGES** *(PO A. Maier)*
Every backlog item names the modules of the architecture that its implementation changes.
*Check:* `tests/test_backlog_item_fields.py` — an item that names no module, or a module the architecture does not
describe, is reported; counter-proof: an item naming modules the architecture describes passes.

**NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED** *(PO A. Maier)*
An implementation job starts for a backlog item only when every requirement and use case the item
names is accepted.
*Check:* `tests/test_job_preconditions.py`. An item that names one open proposal cannot be started.
The same item can be started after an approval record names the proposal's text.

**NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT** *(Vibe Coding, ch. 7 §4)*
When a product's model sets a work-in-progress limit, no implementation job starts while the number
of items in progress under the job's role assignment has reached that limit.
*Check:* `tests/test_wip_limit.py` — starts implementation jobs while items are in progress and counts those items per
role assignment. It checks that a start is refused, naming the limit, while the count has reached the limit, and
succeeds once the count is below it.

**A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT** *(Vibe Coding, ch. 7 §5; PO A. Maier)*
When a product's model works in sprints, a team's implementation jobs start only for items selected for
that team's current sprint.
*Check:* `tests/test_time_box_selection.py` — starts implementation jobs while several teams run sprints and compares
each job's item with its team's current sprint. It checks that a job starts only for an item selected for that sprint.

**EVERY TEAM RUNS SPRINTS OF ITS OWN** *(PO A. Maier)*
Each team of a product plans, starts and closes sprints of its own, which may run at the same time as the sprints of the
product's other teams.
*Check:* `tests/test_parallel_sprints.py` — runs sprints of several teams of one product at the same time. It checks
that each team plans, starts and closes its sprints without affecting the other teams' sprints.

**A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH** *(PO A. Maier)*
An item selected for a team's sprint is held by that sprint until its change is merged into the default branch, the
item returns to the backlog, or the Product Owner gives up the sprint's increment.
*Check:* `tests/test_parallel_sprints.py` — follows held items through their sprint's close, the merges into the
default branch and an increment given up. It checks that an item stays held until its change is merged there, it
returns to the backlog or its increment is given up.

**SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES** *(PO A. Maier)*
Of two items held by sprints of different teams, neither changes a module that the other changes or uses through the
interfaces its modules' files name.
*Check:* `tests/test_parallel_sprints.py` — plans a sprint while other teams' sprints hold items, and compares the
modules each selected item changes and uses with those of the held items. It checks that no selection shares a module
with a held item, and that a refusal names the holding sprint, the item and the module.

**SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD** *(PO A. Maier)*
When a team plans or changes a sprint, every item held by another team's sprint is listed with that sprint, the modules
the item changes and the modules they use.
*Check:* `tests/test_parallel_sprints.py` — opens a team's sprint planning while other teams' sprints hold items, and
compares the listing with those items. It checks that each held item is listed with its sprint, the modules it changes
and the modules they use.

**A JOB GOES ONLY TO A HOLDER OF ITS ROLE** *(PO A. Maier)*
A job is handed only to a participant that the job's role assignment assigns to the role the job belongs to.
*Check:* `tests/test_job_assignment.py` — hands out jobs while a product has several role assignments, and compares each
job's participant with the job's role assignment. It checks that every job goes to a holder of its role in that
assignment.

**A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING** *(PO A. Maier)*
The input Agent M sends with a job that writes or changes requirements or use cases gives chapter 8 of the book *Vibe
Coding* in full.
*Check:* `tests/test_job_reading.py` — builds the input of each kind of job from its job definition, for a job in the
browser and for a job in a checkout of the instance, and compares it with the book's chapter files. It checks that a job
on requirements or use cases receives chapter 8 complete, as its text or as its file in the checkout.

**A TEST JOB RECEIVES THE CHAPTER ON TESTING** *(PO A. Maier)*
The input Agent M sends with a job that writes or changes tests gives chapter 13 of the book *Vibe Coding* in full.
*Check:* `tests/test_job_reading.py` — builds the input of each kind of job from its job definition, for a job in the
browser and for a job in a checkout of the instance, and compares it with the book's chapter files. It checks that a job
on tests receives chapter 13 complete, as its text or as its file in the checkout.

**AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION** *(PO A. Maier)*
The input Agent M sends with a job that writes, changes or reviews the architecture gives chapters 9, 10, 11 and 12
of the book *Vibe Coding* in full.
*Check:* `tests/test_job_reading.py` — builds the input of each kind of job from its job definition, for a job in the
browser and for a job in a checkout of the instance, and compares it with the book's chapter files. It checks that a job
on the architecture receives chapters 9 to 12 complete, as their texts or as their files in the checkout.

**AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING** *(PO A. Maier)*
The input Agent M sends with an implementation job gives chapters 9, 11, 12 and 13 of the book *Vibe Coding* in full.
*Check:* `tests/test_job_reading.py` — builds the input of each kind of job from its job definition, for a job in the
browser and for a job in a checkout of the instance, and compares it with the book's chapter files. It checks that an
implementation job receives chapters 9, 11, 12 and 13 complete, as their texts or as their files in the checkout.

**A JOB IN A CHECKOUT OF THE INSTANCE READS THE CHAPTERS THERE** *(PO A. Maier)*
The input of a job whose participant works in a checkout of the instance gives each chapter of the book *Vibe Coding* as
the path of the chapter's file in that checkout, whose SHA-256 is the one the source register records.
*Check:* `tests/test_job_reading.py` — builds the input of each kind of job for a participant that works in a fixture
checkout of the instance, and reads the files the input names there. It checks that each chapter is given by the path
of its file and none by its text, and that a chapter file whose SHA-256 differs from the register's is refused by name.

**EVERY MODEL READS AGENT M'S AGENTS.MD FIRST** *(PO A. Maier)*
The input Agent M sends to a language model — with a job, or with a message of the prompt bar — begins with Agent M's
own `AGENTS.md`, the one at the root of the instance repository, in full, whatever repository the job or the page works
on; for a participant that works in a checkout of the instance, it begins with the file's path there.
*Check:* `tests/test_job_reading.py` — builds the input of each kind of job and of a message of the prompt bar for a
fixture instance and a fixture product, in the browser and in a checkout of the instance. It checks that each input
begins with the instance's `AGENTS.md`, as its text or as its path in the checkout; counter-proof: an input that leaves
it out, puts it later, or gives the product's file in its place fails.

**A JOB STOPS AT EVERY GATE** *(PO A. Maier; Vibe Coding, ch. 11 §8)*
A job that reaches a gate of the product's workflow waits in the state *waiting at a gate* until the
decision of that gate's decider is recorded.
*Check:* `tests/test_job_gate.py`. A fixture job reaching a gate does not proceed while no decision of
the gate's decider is recorded, nor on a record by anyone else. It proceeds on the decider's record — a
person's, an agent's or a CI check's, as the gate names.

**A GATE NAMES WHO DECIDES IT** *(PO A. Maier)*
Every gate names its decider: a role of the model, held by a person or an agent as the role allows, or
an automated check whose result decides.
*Check:* `tests/test_model_validation.py` — a gate without a decider is rejected; counter-proof: a gate
decided by a role and one decided by a named CI check both pass validation.

**A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT** *(PO A. Maier)*
A gate that a job reaches is passed only by a decision of a holder of the deciding role in the job's role assignment.
*Check:* `tests/test_job_gate.py` — records gate decisions from holders of the deciding role across several role
assignments, and compares each decider with the job's role assignment. It checks that only a decision from within that
assignment passes the gate.

**A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS** *(PO A. Maier; Vibe Coding, ch. 12 §2, ch. 13 §6)*
A gate's decision recorded by the participant that did the work the gate checks does not pass it.
*Check:* `tests/test_job_gate.py` — the implementing agent's own record leaves the job waiting;
counter-proof: a second agent holding the deciding role passes it.

**A JOB IS RECORDED IN ITS PRODUCT REPOSITORY** *(PO A. Maier)*
Every job other than a conversation held in a browser tab has a record `docs/jobs/JOB-<id>.md` in the repository of the
product it works on — the instance's own repository for a job of the instance — naming its inputs, participant, runtime
and start, and, once it has ended, its end state and results.
*Check:* `tests/test_job_record.py` — a job in the tab, in CI and on a Bridge each leaves its record; counter-proof: a
conversation held in the tab leaves none.

**A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON** *(PO A. Maier)*
No message of a conversation between a person and a participant on the dashboard is written to a repository unless the
instance repository's settings switch on recording conversations.
*Check:* `tests/test_conversation_not_recorded.py` — with recording off, a fixture conversation in which the participant
reads files, proposes an edit that the person saves, and hands its task to CI leaves no message's text in any commit,
commit message or job record; counter-proof: a message planted in the job record of the handover is found.

**A RECORDED CONVERSATION IS KEPT WHERE IT WAS HELD** *(PO A. Maier)*
While recording conversations is switched on, every message of a conversation is recorded under `docs/conversations/`
of the repository of the product whose page the conversation is held on — the instance's own repository for a page of the
instance.
*Check:* `tests/test_conversation_not_recorded.py` — with recording on, each message of a fixture conversation on a
product's page is found in a conversation record of that product, and one on an instance page in the instance's;
counter-proof: a message missing from the record fails.

**SWITCHING CONVERSATION RECORDING ON STATES WHAT FOLLOWS** *(PO A. Maier)*
Before recording conversations is switched on, the dashboard states that every message will be committed to the
repository of the page it is held on, naming each such repository its server reports as public.
*Check:* `tests/test_settings_disclosure.py` — the switch stores nothing before the notice is acknowledged, and the
notice names a fixture public product; counter-proof: a private product is not named as public.

**A JOB IDENTIFIER IS NEVER REUSED** *(PO A. Maier)*
No two jobs of a product share an identifier, a retried job included.
*Check:* `tests/test_job_record.py`

**PROGRESS AND JOB STATE ARE DERIVED, NOT STORED** *(PO A. Maier)*
Everything the process dashboard and the job dashboard show is computed from the repositories and
the runtimes. Neither dashboard stores a status of its own.
*Check:* `tests/test_progress_derived.py`. Deleting all local storage and reloading shows the same
progress and the same job states.

**PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE** *(PO A. Maier; Vibe Coding, ch. 15 §2–3)*
The process dashboard shows a product's progress in the measure its model definition names: plan
entries per phase against the plan, remaining items per time box, or items per state over time.
*Check:* `tests/test_progress_view.py`. A V-model, a Scrum and a Kanban fixture each render their
declared measure. A definition naming an unknown measure fails validation.

**ONE DASHBOARD SHOWS EVERY JOB** *(PO A. Maier)*
The job dashboard of an instance lists every job of every product it manages. Each job appears with
its state (queued, running, waiting at a gate, done, failed, cancelled or ended without record), its
participant, where it runs, what it works on, its elapsed time and a link to its log.
*Check:* `tests/test_job_dashboard.py`. Fixture jobs in two products and three runtimes appear in
one list. A job state outside the seven is rejected.

**A CANCELLED JOB WRITES NOTHING MORE** *(PO A. Maier)*
After a person cancels a job, the job commits nothing further to any repository.
*Check:* `tests/test_job_cancel.py`. A fixture job cancelled between its test commit and its
implementation commit leaves the branch at the test commit.

**NO COST IS GUESSED** *(PO A. Maier; Vibe Coding, ch. 15 §4)*
A job shows a cost only when its runtime reports one, or when the runtime reports usage and the
participant declares a price for it. In every other case the cost is shown as unknown.
*Check:* `tests/test_job_cost.py`. A job whose runtime reports neither cost nor usage shows
"unknown", never zero.

**A PRODUCT DECLARES ITS DEFINITION OF DONE** *(PO A. Maier; Vibe Coding, ch. 7 §5, after the Scrum Guide)*
A product declares, in a data file of its own repository, the conditions an implementation job's
pull request must meet before it counts as done.
*Check:* `tests/test_definition_of_done.py`

**THE DEFAULT DEFINITION OF DONE IS THE JOB RULES** *(PO A. Maier)*
Without a declaration, a pull request is done when its CI run is green, the job's first commit held
only failing tests — or, for a refactoring job, CI was green on every commit and no expected result
changed —, it changes only the job's modules, every new test names the requirement it guards and the
module it exercises, and every gate the workflow places before the merge is recorded.
*Check:* `tests/test_definition_of_done.py`

**A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS** *(PO A. Maier)*
An implementation job's pull request is merged only when every condition of the product's Definition
of Done holds, checked in the product's CI.
*Check:* `tests/test_definition_of_done.py` — a pull request missing one condition is not mergeable;
counter-proof: with all conditions met it is.

**A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT** *(Vibe Coding, ch. 7 §5; PO A. Maier)*
A sprint of a product is closed only after a review of its increment is recorded: what was done,
who took part, and the feedback, which enters the backlog as items.
*Check:* `tests/test_time_box_close.py`

**A SPRINT ENDS WITH A RETROSPECTIVE** *(Vibe Coding, ch. 7 §5; PO A. Maier)*
A sprint of a product is closed only after its retrospective is recorded: what the team — people
and agents — will change in how it works.
*Check:* `tests/test_time_box_close.py`

**A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN** *(PO A. Maier)*
A product may give a phase or a sprint a branch of its own, into which
its work is merged; merging that branch into the default branch is then the gate at its end, decided
by the role the model names for that gate — in Scrum the Product Owner, after the review of the
increment.
*Check:* `tests/test_phase_branch.py`

**WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET** *(PO A. Maier)*
Without a branch for the current phase or sprint, the work of every job is merged into the default
branch.
*Check:* `tests/test_phase_branch.py`

**A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION** *(PO A. Maier)*
A person can start one run over any selection of the product's accepted work — one module, several or
all, or, in a model that works from a backlog, backlog items — and Agent M carries it out as jobs in the
phases, order, roles and gates of the product's declared process model.
*Check:* `tests/test_process_run.py` — a V-model fixture with three accepted modules yields, from one
start, the jobs of every phase for all three in the model's order.

**A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS** *(PO A. Maier)*
Within a run, each job starts by itself as soon as the jobs it depends on are done, until the run is
finished, waits at a gate its model gives to a person, or reaches one of its limits.
*Check:* `tests/test_process_run.py` — a fixture run of five jobs without a person's gate needs one start
and no further click; counter-proof: with a gate decided by a person, it waits there and nowhere else.

**A RUN FOLLOWS THE MODULES' INTERFACES** *(PO A. Maier)*
Within a run, a module is implemented only after every module whose interfaces it uses.
*Check:* `tests/test_process_run.py` — for modules A → B → C and D, C starts after B and B after A, while D
runs alongside; counter-proof: a cycle in the interfaces is refused before the run starts, and named.

**A RUN SETS UP CI BEFORE IT IMPLEMENTS** *(PO A. Maier)*
A run whose product has no CI configuration generated from its test schedule creates it before its first
implementation job.
*Check:* `tests/test_process_run.py`

**A RUN HAS LIMITS FIXED AT ITS START** *(PO A. Maier)*
Before a run starts, it states how many jobs may run at once, its cost limit and its correction-round
limit, and it stops starting jobs when one of them is reached.
*Check:* `tests/test_process_run.py` — a run whose reported cost reaches its limit starts no further job
and says why; counter-proof: below the limit it continues.

**A RUN IS A JOB THAT NAMES ITS JOBS** *(PO A. Maier)*
A run is recorded as a job whose record lists every job it started, and each of those jobs names the run.
*Check:* `tests/test_job_record.py`

**A RUN ENDS WITH THE VALIDATION OF ITS MODULES** *(PO A. Maier)*
When a run ends, the dashboard shows for its selection what each module realises, which code and tests
belong to it, and every gap.
*Check:* `tests/test_process_run.py`

**CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT** *(PO A. Maier)*
The Product Owner may assign closing a sprint — its review, its retrospective and the decisions on its
unfinished items — to a participant of the product, a person or an agent.
*Check:* `tests/test_time_box_close.py` — a sprint whose close is assigned to an agent fixture is closed
with a review and a retrospective recorded by that agent.

**A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF** *(PO A. Maier)*
When closing a sprint is assigned to an agent, its job starts by itself when the sprint's time box ends or, in a
sprint without one, when every selected item is done.
*Check:* `tests/test_time_box_close.py`

**AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM** *(PO A. Maier)*
A review recorded by an agent names the sources of its feedback — issues, mails, job records, test
results — and states that no stakeholder took part unless one did.
*Check:* `tests/test_time_box_close.py` — a review by an agent without stakeholder input says so; counter-
proof: a review listing a stakeholder names where their feedback is recorded.

**AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF** *(PO A. Maier)*
A rule of the development process — in the process model, the Definition of Done or a participant's instructions —
changes only through a change of the SPEC that a person accepts, never through an agent's retrospective or through
instructions kept outside the repository, where the person cannot read them.
*Check:* `tests/test_time_box_close.py` — after an agent's retrospective, the model, the Definition of Done, the
participants and the job definitions are byte-identical, and every change it recommends is an open entry of a SPEC change
queue; counter-proof: a retrospective that writes one of these files fails. `tests/test_job_reading.py` — the input of
each kind of job is its prompt with its recipes' inputs and nothing else; counter-proof: an input that adds an
instruction from a file outside the repository fails.
## 14. Issues, mail and personal data

**A MAILBOX IS REACHED THROUGH ITS PROVIDER'S WEB API OR THROUGH THE BRIDGE** *(PO A. Maier)*
The dashboard reaches a Microsoft 365 mailbox directly through Microsoft Graph, and any other mailbox —
Gmail included — over IMAP and SMTP through the bridge its connection names.
*Check:* `tests/test_mail_routes.py` — reads a Microsoft 365 fixture mailbox and IMAP fixture mailboxes, a Gmail one
included, whose connections name different bridges, and records every request. It checks that the Microsoft 365 mailbox
is read with no bridge request, and that each IMAP mailbox is read only through the bridge its connection names.

**AN API MAILBOX IS OPENED BY THE PROVIDER'S SIGN-IN** *(PO A. Maier)*
A mailbox reached through its provider's web API is authorised by that provider's sign-in in the
browser; Agent M asks for no mailbox password.
*Check:* `tests/test_mail_routes.py` — the API route stores no password; counter-proof: the IMAP route
asks for one.

**THE MAIL SIGN-IN ASKS ONLY FOR READING, DRAFTING AND SENDING** *(PO A. Maier)*
The provider sign-in asks for no permission beyond the narrowest ones its provider offers for reading
mail, creating drafts and sending mail.
*Check:* `tests/test_mail_routes.py` — the requested scopes are exactly `Mail.ReadWrite`, `Mail.Send` and
`offline_access`.

**THE MAIL SIGN-IN TOKEN GOES ONLY TO ITS PROVIDER** *(PO A. Maier)*
A mailbox token from a provider sign-in leaves the browser only as the authorisation of requests to that
provider's API.
*Check:* `tests/review-core.test.mjs` — a request to any other origin carries no mailbox token;
counter-proof: the request to the provider carries it.

**THE MAILBOX PASSWORD IS STORED ONLY AFTER ITS OWN DISCLOSURE** *(PO A. Maier)*
Before a mailbox password is stored, Agent M states that every GitHub Pages site under the same
`<owner>.github.io` can read it, and what it grants: reading every mail of the mailbox and sending
mail in its name.
*Check:* `tests/test_settings_disclosure.py` — the mailbox form stores nothing before the notice is
acknowledged.

**THE MAILBOX PASSWORD LEAVES THE BROWSER ONLY TO THE BRIDGE** *(PO A. Maier)*
The mailbox password leaves the browser only inside a request to the bridge its connection names.
*Check:* `tests/test_mail_password_route.py` — records every outgoing request of a full mail run while two bridges are
stored. It checks that the password appears only in requests to the address of the bridge the connection names.

**A MAILBOX THROUGH THE JUMP HOST IS NAMED AS READABLE THERE** *(PO A. Maier)*
Before a mailbox connection whose bridge is reached through the jump host is saved, the dashboard states that the jump
host can read the mailbox password and the mails.
*Check:* `tests/test_settings_disclosure.py` — saves fixture IMAP connections, one whose bridge is reached through the
jump host and one whose bridge runs on this computer. It checks that the first is stored only after the notice is
acknowledged, and that the second is stored with no such notice.

**THE BRIDGE HOLDS THE MAILBOX PASSWORD ONLY FOR ONE REQUEST** *(PO A. Maier)*
The bridge keeps the mailbox password only in memory, for the duration of the request that carried
it.
*Check:* `tests/test_bridge_mail.py` — after a run with a marker password, no file below the bridge's
directories and no log line contains it; counter-proof: a bridge that logs the request fails.

**THE MAIL SERVER IS REACHED ONLY OVER TLS** *(PO A. Maier)*
The bridge sends a login to an IMAP or SMTP server only over an encrypted connection — implicit TLS
or STARTTLS.
*Check:* `tests/test_bridge_mail.py` — against a local test server without TLS, no `LOGIN`/`AUTH` is
sent.

**READING THE MAILBOX CHANGES NOTHING IN IT** *(PO A. Maier)*
Reading mails for issues neither marks a mail as read nor moves, deletes or flags it.
*Check:* `tests/test_bridge_mail.py` — a read against a test server issues no `STORE`, `COPY`,
`MOVE`, `EXPUNGE` and no non-peek `FETCH`.
On the web-API routes, a read issues no request that modifies a message (`tests/test_mail_routes.py`).

**MAIL STAYS IN THE MAILBOX** *(PO A. Maier)*
The text of a mail, its sender, its reply address and its attachments are kept only in the mailbox;
Agent M writes them to no repository, issue tracker or file.
*Check:* `tests/test_mail_privacy.py` — after a full run on test mails, no write of Agent M contains a
sender address, a sender name, the body of a mail as a whole or one of its attachments; counter-proof: a
planted body in a job record is found.

**THE ISSUE IS THE ONLY RECORD OF A MAIL'S HANDLING** *(PO A. Maier)*
Which mails an issue concerns, which of them were answered, and whether the issue waits for a reporter
are recorded only in the product's issue tracker.
*Check:* `tests/test_mail_replies.py` — the mail dashboard's groups are computed from issues and the
mailbox alone; counter-proof: clearing the browser's storage changes none of them.

**A MAIL IS NAMED BY A PSEUDONYMOUS IDENTIFIER** *(PO A. Maier)*
Every mail Agent M handles has the identifier `MAIL-` followed by the first sixteen hexadecimal digits
of the SHA-256 of its `Message-ID`, or of its bytes when it has none.
*Check:* `tests/test_mail_import.py` — the identifier is stable across two readings of the same mail;
counter-proof: two mails with different `Message-ID`s get different identifiers.

**A MAIL IS FOUND AGAIN BY ITS IDENTIFIER** *(PO A. Maier)*
To show or answer a mail an issue lists, Agent M finds it in the mailbox by hashing the `Message-ID`s
of the folders the mailbox connection names — `INBOX` unless others are named.
*Check:* `tests/test_bridge_mail.py` — a mail moved to a named folder is found; counter-proof: an
identifier with no matching mail yields *not found in the mailbox*, never a guess.

**AN ISSUE FROM A MAIL NAMES ITS MAILS BY THEIR IDENTIFIERS** *(PO A. Maier)*
An issue created from a mail, and every issue a further report is added to, lists the `MAIL-`
identifiers of its reports.
*Check:* `tests/test_mail_replies.py` — closing an issue with two listed identifiers offers two replies,
found through the identifiers alone.

**A MAIL ALREADY DECIDED IS NOT PROPOSED AGAIN** *(PO A. Maier)*
A mail that an issue lists, or that the person marked *not an issue* in this browser, is not proposed
again.
*Check:* `tests/test_mail_import.py` — a second reading proposes no listed and no marked mail;
counter-proof: an unmarked new mail is proposed.

**THE PRODUCT ISSUE CARRIES NO PERSONAL DATA** *(PO A. Maier)*
An issue created from a mail contains no name, mail address, phone number or signature of anyone
named in the mail.
*Check:* `tests/test_mail_privacy.py` — deterministic: every address and display name from the mail's
headers, and every address and phone number found in its body, is absent from the issue text. How
often the participant's neutral text still contains personal data is measured as a rate on a fixed
set of mails, reported, not gated.

**A MAIL BECOMES AN ISSUE ONLY BY A PERSON'S CLICK** *(PO A. Maier)*
An issue is created from a mail only as the direct result of a person's click on the proposed issue
text.
*Check:* `tests/test_mail_import.py` — a run without the click creates no issue; the participant's
job definition contains no issue-creating call.

**AN ISSUE FROM A MAIL IS A DEFECT OR A CHANGE** *(PO A. Maier)*
Every issue created from a mail is labelled either as a defect against the current SPEC or as a
request for changed behaviour.
*Check:* `tests/test_mail_import.py`

**A MAIL IN A KNOWN THREAD IS MATCHED WITHOUT A MODEL** *(PO A. Maier)*
A mail whose `In-Reply-To` or `References` names a mail that an issue lists is attached to that issue —
its identifier added to the issue's list — before any participant sees it.
*Check:* `tests/test_mail_import.py`

**A DUPLICATE MAIL IS ADDED TO THE EXISTING ISSUE** *(PO A. Maier)*
A mail the person confirms as describing an existing issue adds its identifier to that issue instead of
creating a new one.
*Check:* `tests/test_mail_import.py`

**EVERY OUTGOING MAIL IS RELEASED BY A PERSON** *(PO A. Maier)*
Agent M sends a mail only as the direct result of a person's click on the complete mail shown to them —
recipients, subject, body and attachments.
*Check:* `tests/test_mail_routes.py` — on both routes, no send request is made without the click;
counter-proof: with it, exactly one.

**THE BRIDGE SENDS ONLY WITH A CONFIRMATION OF THE MAIL SHOWN** *(PO A. Maier)*
The bridge sends a mail only with a single-use confirmation that names the SHA-256 of the complete mail
shown to the person.
*Check:* `tests/test_bridge_mail.py` — sending mocked: without confirmation, with a reused one, or
with a body changed after the preview, zero SMTP calls.

**A REPLY IS THREADED ON THE REPORTER'S MAIL** *(PO A. Maier)*
A reply to a report carries that report's `Message-ID` in `In-Reply-To` and `References`, wherever the
reporter stands among the recipients.
*Check:* `tests/test_bridge_mail.py`

**A REPLY GOES TO ONE REPORTER** *(PO A. Maier)*
A reply to one report has no reporter of another report among its recipients.
*Check:* `tests/test_mail_replies.py` — an issue with three reports yields three mails, each with one
reporter.

**CLOSING AN ISSUE PREPARES ITS REPLIES** *(PO A. Maier)*
When an issue that lists mails is closed, the mail dashboard offers to draft a reply for every listed mail
that has no sent reply noted in the issue.
*Check:* `tests/test_mail_replies.py` — a closed issue listing two mails yields two offers; counter-proof:
with a reply noted for one, one offer.

**A REPLY DRAFT IS KEPT IN THE MAILBOX'S DRAFTS FOLDER** *(PO A. Maier)*
A reply drafted for a mail an issue lists is stored as a draft in the mailbox's *Drafts* folder, as a
reply to that mail, and nowhere else.
*Check:* `tests/test_mail_replies.py` — after drafting, the draft is in *Drafts* with `In-Reply-To`
set, and no write outside the mailbox contains its text.

**THE SEND DASHBOARD LISTS THE DRAFTS OF LISTED MAILS** *(PO A. Maier)*
The send dashboard shows every draft in the *Drafts* folder that replies to a mail an issue lists.
*Check:* `tests/test_mail_replies.py` — a draft replying to a listed mail is shown; counter-proof: an
unrelated draft of the person is not.

**A REPLY SENT FROM THE MAIL PROGRAM IS NOTED TOO** *(PO A. Maier)*
A reply to a listed mail found in the *Sent* folder is noted in the issue, whether it was sent from the
dashboard or from a mail program.
*Check:* `tests/test_mail_replies.py` — a reply placed in *Sent* by hand is noted at the next reading;
counter-proof: an unrelated sent mail is not.

**A SENT REPLY IS NOTED IN THE ISSUE** *(PO A. Maier)*
When a reply is sent, the issue receives a comment naming the mail's identifier and the date, and
nothing of the reply's text or recipient.
*Check:* `tests/test_mail_replies.py` — after sending, the issue has one comment with the identifier and
date and no address; counter-proof: no draft is offered for that mail again.

**AN ISSUE WAITING FOR A REPORTER IS LABELLED** *(PO A. Maier)*
An issue for which a question has been sent to a reporter carries the label `waiting-for-reporter` until
a person removes it.
*Check:* `tests/test_mail_replies.py`

**A REPORTER'S ANSWER IS SHOWN AT ITS ISSUE** *(PO A. Maier)*
A mail answering an issue labelled `waiting-for-reporter` is shown under that issue in the mail
dashboard as *answer received*.
*Check:* `tests/test_mail_replies.py`

**A CLOSED ISSUE IS REOPENED ONLY BY A PERSON** *(PO A. Maier)*
A closed issue returns to open only by a person's click.
*Check:* `tests/test_mail_replies.py`

**THE PLACES A MAILBOX'S MAIL MAY GO ARE CONFIGURED** *(PO A. Maier)*
Each mailbox connection names the processing places to which its mails may be given, and a
participant that processes data elsewhere is never given them.
*Check:* `tests/test_mail_privacy.py` — a mail is not sent to a participant whose processing place is
not listed; counter-proof: it is sent to one whose place is.

**A PLACE OUTSIDE THE EU IS NAMED AS NOT COMPLIANT** *(PO A. Maier)*
When a processing place outside the European Union is allowed for a mailbox, the dashboard states,
before saving, that processing personal data there does not comply with the EU's rules — the GDPR
for transferring personal data, and the EU AI Act.
*Check:* `tests/test_settings_disclosure.py`

**NO PERSONAL DATA FROM A MAIL ENTERS A REPOSITORY** *(PO A. Maier)*
No file, commit message, issue, comment or label that Agent M writes contains personal data taken from
a mail.
*Check:* `tests/test_mail_privacy.py` — after a full run on test mails — issue, backlog item, SPEC
proposal, regression test, job record, reply note —, no write contains any name,
address, phone number or account from those mails; counter-proof: a planted address in a job record is
found.

**A TEXT FROM A MAIL IS SEARCHED FOR THAT MAIL'S PEOPLE** *(PO A. Maier)*
Before Agent M writes text drawn from a mail — an issue's text, report data — to an issue tracker or a
repository, it searches the text for every name, mail address, phone number and account found in that
mail, and writes nothing while one is found.
*Check:* `tests/test_mail_privacy.py` — an issue text containing the sender's name, or a name from the
mail's signature, is refused and the hit named; counter-proof: the same text without the name passes.

**A PARTICIPANT THAT WRITES TO A REPOSITORY NEVER RECEIVES A MAIL** *(PO A. Maier)*
A job that writes to a repository is given the neutral issue and the report data as the issue holds it —
rewritten without persons unless the product switched that off —, never the text or attachments of a mail.
*Check:* `tests/test_mail_privacy.py` — the inputs of an implementation job started from a mail's issue
contain no text of the mail.

**REPORT DATA LEAVES THE MAILBOX ONLY REWRITTEN WITHOUT PERSONS** *(PO A. Maier)*
Attachments, logs, error messages, screenshots' text and data files from a mail go into an issue or a
repository only as a participant's rewriting that mentions no person and keeps their technical content.
*Check:* `tests/test_mail_privacy.py` — a fixture log with a name, a mail address, a phone number, an IP
address and a home-directory path, rewritten by a fixture participant, contains none of them; counter-proof:
a rewriting that keeps one is refused. How often a rewriting keeps the error message, stack trace and
version is measured as a rate on a fixed set of reports, reported, not gated.

**A REWRITTEN TEXT IS CHECKED BY THREE LLMS** *(PO A. Maier)*
A text that a participant rewrites from a mail is written only after three LLM participants with three
different models, at places the mailbox allows, have each checked it for any mention of a person and none
of them has found one.
*Check:* `tests/test_mail_privacy.py` — with three fixture checkers of which one reports a name, nothing is
written and the finding goes back; counter-proof: when none reports one, the text is written. How often a
person passes all three is measured as a rate on a fixed set of mails, reported, not gated.

**NO CHECKER IS THE REWRITER** *(PO A. Maier)*
None of the three participants that check a rewritten text is the participant that rewrote it or uses its
model.
*Check:* `tests/test_mail_privacy.py` — a set of checkers that includes the rewriter, or a checker with the
rewriter's model, is refused before anything is sent; counter-proof: three checkers with three other models
are accepted.

**PSEUDONYMISATION IS ON UNLESS A PRODUCT SWITCHES IT OFF** *(PO A. Maier)*
Rewriting report data without persons applies to every product whose settings do not switch it off.
*Check:* `tests/test_mail_privacy.py` — a product without the setting gets rewritten report data;
counter-proof: a product that switched it off gets the original data.

**SWITCHING PSEUDONYMISATION OFF STATES WHAT FOLLOWS** *(PO A. Maier)*
Before a product's pseudonymisation is switched off, the dashboard states that report data will then
enter the product's issues and repository unchanged, that this is advisable only on a protected,
non-public data space, and — for a repository its server reports as public — that the data will be
published.
*Check:* `tests/test_settings_disclosure.py`

**A PERSON IS NAMED BY ACCOUNT OR WITH CONSENT** *(PO A. Maier)*
A repository managed by Agent M names a person only by their account on its server, or by name if the
person is listed as consenting in the repository's `docs/collaborators.md`.
*Check:* `tests/test_collaborators.py` — a name in a generated artifact that is neither an account nor
in `docs/collaborators.md` is reported; counter-proof: a listed collaborator's name passes.
## 15. Product resources

**A PRODUCT DECLARES ITS RESOURCES** *(PO A. Maier)*
A product names the resources it is built with, tested on or calls at runtime in
`docs/resources.md` of its own repository, one entry per resource.
*Check:* `tests/test_resources.py` — a product with a declared resource has it in
`docs/resources.md`; counter-proof: a resource entry written anywhere else is not found and fails.

**A RESOURCE IS USED, A PARTICIPANT DEVELOPS** *(PO A. Maier)*
Whatever does work on the product's artifacts is declared as a participant, never as a resource.
*Check:* `tests/test_resources.py` — a resource entry carrying participant fields (capabilities,
role) is rejected; counter-proof: the same entry without them is accepted.

**ONE SYSTEM IN TWO ROLES IS TWO ENTRIES** *(PO A. Maier)*
A system that the product uses and that also works on the product is declared once as a resource
and once as a participant, each entry complete on its own.
*Check:* no automatic check; at review.

**A RESOURCE'S TERMS ENTER AS A SOURCE** *(PO A. Maier)*
A rule a resource imposes on the product — its licence, an endpoint's usage policy — becomes a
requirement only through a source registered in the library and linked to the product (UC-004,
UC-015).
*Check:* `tests/test_requirement_has_source.py` — a requirement naming a resource entry as its
source is rejected; counter-proof: the same requirement naming the registered licence source passes.

**THE RESOURCE KIND IS ONE OF A CLOSED SET** *(PO A. Maier)*
A resource has exactly one kind from: `repository`, `data`, `model`, `compute`, `endpoint`,
`agent`.
*Check:* `tests/test_resources.py` — an unknown kind is rejected; counter-proof: each of the six is
accepted.

**A RESOURCE IS PINNED TO AN EXACT STATE** *(PO A. Maier)*
A resource of kind `repository`, `data`, `model`, `endpoint` or `agent` records the exact state the
product uses — a commit for a repository, a revision or the SHA-256 of every file for data or a model,
the identifier of the served model for an endpoint or an agent.
*Check:* `tests/test_resources.py` — a `model` entry without revision or hash fails; counter-proof:
the same entry with a 40-hex revision passes, and a `compute` entry without a pin passes.

**A COMPUTE ENVIRONMENT IS PINNED IN THE JOB'S OWN FILES** *(PO A. Maier)*
The software environment a job uses on a `compute` resource — a container image by its digest, or the
loaded modules with their versions — is fixed in the product's versioned job files, not in its resource
entry.
*Check:* no automatic check; at review.

**A PINNED RESOURCE MOVES ONLY WHEN A PERSON MOVES IT** *(PO A. Maier)*
The recorded state of a resource changes only by a person's decision on the dashboard.
*Check:* `tests/review-core.test.mjs` — a newer upstream commit is reported and `docs/resources.md`
is unchanged; counter-proof: after the *Move* click it carries the new commit.

**A RESOURCE DECLARES ITS LICENCE** *(PO A. Maier)*
Every resource of kind `repository`, `data` or `model` records the licence or terms under which it
may be used and redistributed.
*Check:* `tests/test_resources.py` — such an entry without a licence field fails; counter-proof:
the same entry with `MIT` passes.

**A RESTRICTED RESOURCE IS REFERENCED, NEVER COPIED** *(PO A. Maier)*
Agent M writes no content of a resource whose licence does not permit redistribution, or is
unknown, into the product repository.
*Check:* `tests/test_resources.py` — declaring a restricted resource commits only
`docs/resources.md`; counter-proof: a fixture that adds a file from the resource fails.

**A RESOURCE NAMES ITS MAINTAINER** *(Vibe Coding, ch. 6 §5)*
Every resource of kind `repository`, `data`, `model` or `agent` records who maintains it — by account,
by organisation, or by the name of a consenting collaborator — or states that this is unknown.
*Check:* `tests/test_resources.py` — an entry with neither a maintainer nor `unknown` fails;
counter-proof: `unknown` passes.

**A RESOURCE ENTRY NAMES ITS SECRET, NOT ITS VALUE** *(PO A. Maier)*
A resource that needs a credential names where the credential is held — a CI secret by name, or a
key stored in the browser — and never contains the credential.
*Check:* `tests/test_no_secret_written.py` — a configured resource credential written into
`docs/resources.md` fails the run; counter-proof: the secret's name alone passes.

**A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE** *(PO A. Maier)*
A credential stored for a resource leaves the browser only as the authorisation of requests to that
resource's server.
*Check:* `tests/review-core.test.mjs` — a request to any other origin carries no resource
credential; counter-proof: the request to the resource's own server carries it.

**A COMPUTE RESOURCE IS REACHED THROUGH THE BRIDGE OR A SELF-HOSTED RUNNER** *(PO A. Maier)*
A resource of kind `compute` names the route by which jobs reach it, which is either a bridge identified
by its name (UC-011) or a self-hosted runner identified by its label.
*Check:* `tests/test_resources.py` — validates fixture `compute` entries with the resource schema. It checks that a route
`bridge <name>` or `runner:<label>` is accepted, and that an entry without a route, or with another route, is rejected.

**A RESOURCE DECLARES WHERE IT PROCESSES DATA** *(PO A. Maier)*
Each resource of kind `compute`, `endpoint` or `agent` states where the data given to it is
processed.
*Check:* `tests/test_resources.py` — such an entry without a processing place fails;
counter-proof: `NHR@FAU, Erlangen` passes.

**A JOB RUNS ONLY WHERE ITS RESOURCES ARE REACHABLE** *(PO A. Maier)*
A job that needs a resource is offered only on runtimes and participants that reach it by the
route the resource names.
*Check:* `tests/test_resources.py` — a job needing a `runner:gpu` compute resource is not offered
on a GitHub-hosted runner; counter-proof: it is offered on the runner with label `gpu`.

**THE INSTANCE DECLARES ITS OWN RESOURCES** *(PO A. Maier)*
An instance names the resources its own jobs use — clusters, runners, endpoints — in
`docs/resources.md` of its own repository.
*Check:* `tests/test_resources.py`

**INSTANCE AND PRODUCT RESOURCES ARE INDEPENDENT** *(PO A. Maier)*
A product's resource list neither inherits from nor is inherited by the instance's; an entry in one
list has no effect on the other.
*Check:* `tests/test_resources.py`
## 16. Usability

**ONE CLICK PER DECISION** *(PO A. Maier)*
A decision a person makes on the dashboard — accept, save, add a product, release — takes one click
once its inputs are complete, and everything that follows from it is done by Agent M.
*Check:* no automatic check; at review of each use case.

**A FORM OPENS WITH ITS FIRST FIELD FOCUSED** *(PO A. Maier)*
When a person's action opens or shows a form on the dashboard, the input focus moves to the first field of that form that
is open for the person's input — a box to tick or a field to fill in.
*Check:* `tests/dashboard-review-flows.test.mjs` — after each control that opens a form — *Store a token* and *Change* on
the settings page, *Change* of a GitLab project token, *+ Add product* — the focus is in that form's first open field: on the
token form the notice's box *I have read this* while it is not ticked, the paste field once it is; counter-proof: with the
focus left on the control that opened it, the case fails.

**A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE** *(PO A. Maier)*
While a page of the dashboard is open in a browser where the person has switched notifications on, the browser shows a
notification when a SPEC change, a use case, an architecture file or a release test report comes to wait for the person's
acceptance.
*Check:* `tests/dashboard-notifications.test.mjs` — between two checks of a fixture instance, a newly open use case and a
newly open SPEC change yield one notification each, naming the file and linking the page where it is accepted; counter-proof:
a file already notified, or notifications switched off, yields none.

**NOTIFICATIONS ARE SWITCHED ON BY THE PERSON** *(PO A. Maier)*
The dashboard asks the browser's permission to show notifications only on the person's click that switches them on in the
settings.
*Check:* `tests/dashboard-notifications.test.mjs` — no page of the dashboard asks for the permission before that click;
counter-proof: the click asks once.