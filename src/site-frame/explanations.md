# The folded explanations

**REGISTER**

The texts behind *What is this?* on the pages of Agent M and in the Bridge's window, one section per topic: its heading
names the topic, a lower-case slug, and the Markdown below it, up to the next topic, is shown when the explanation is
unfolded. Each is written for someone new to what the step asks.

## process-model

A process model says how the product's team — people and agents — works: who does what, in which order, and where
someone has to approve before the work goes on. A product declares one before its implementation starts; its
requirements, use cases and architecture are worked out the same way whatever the model.

The model is not the rules the product has to meet:

| | The process model — chosen here | The rules to be met — not chosen here |
|---|---|---|
| answers | *how* the team works: roles, phases, order, gates | *what* has to hold: of the product, or of the way it is built |
| comes from | your decision, from the book's catalogue | requirement sources, as requirements |
| examples | V-model, Scrum, Kanban | "exports are PDF" (product); IEC 62304 class B: "unit verification is documented" (process) |
| effect | defines the workflow | a process requirement adds gates and artifacts to the workflow, never replaces it |

The catalogue holds the book's five models in two groups. The *plan-driven* ones — waterfall, V-model and
reuse-oriented — plan the work in advance and build the software along an implementation plan. The *agile* ones pull
their work from an ordered backlog: Scrum in sprints, Kanban as a steady flow with a limit on the work in progress. Each
model shows the risk it manages well, the risk it accepts and a project it suits. In the book *Vibe Coding*: chapter 6
for the plan-driven models, chapter 7 for the agile ones.

## models-shipped

The shipped models are the book's process models: waterfall, V-model and reuse-oriented, which run the whole accepted
SPEC through every phase, and Scrum and Kanban, which pull their items from a backlog. A shipped model cannot be edited
in an instance. Choose *Adapt* instead: it opens a copy under a new name of your own, and the shipped catalogue stays as
the book has it. In the book *Vibe Coding*: chapter 6 for the plan-driven models, chapter 7 for Scrum and Kanban.

## models-own

The instance's own models are definitions of how products are developed, each a data file under `docs/process-models/` of
this instance. *Edit* opens one of them. *+ New model* starts from nothing and first asks for the kind of work, planned or
pulled. A model that is saved appears in the catalogue of every product of the instance. A definition with an error can
be declared by no product. In the book *Vibe Coding*: chapter 6 for the plan-driven models, chapter 7 for Scrum and Kanban.

## model-kind

The kind of work is *planned* or *pulled*. In a planned model the whole accepted SPEC runs through every phase. In a
pulled model, items are pulled from a backlog. In the book *Vibe Coding*: chapter 6 for the plan-driven models, chapter 7
for the pulled ones.

## model-products

These are the products of this browser whose declaration names the model. A product keeps the version of the definition
it declared, until its author opens *How this product is developed* and saves the product's declaration again. A product
that cannot be read is named above the models, with its reason.

## model-findings

A finding names a rule that the definition breaks, for example a transition that leads to a phase the model does not
define, or a gate without a decider. A definition with an error can be declared by no product.

## roles-and-participants

A model names its roles. For each role it says whether a person, an agent or either may hold it, whether one participant
fills it or several may, and which capabilities its holder needs — for example *write to the repository* or *run code and
tests*. The process names the roles and no one: who holds them is set in the product's role assignment — one, or one per
team in a model that works in sprints — from this instance's participants: people, model endpoints, CI agents, CLI agents
and sandboxed agents. The page *Roles* offers for a role only participants with every capability it needs, each with the
place where it processes the data it is given; where no participant has them all, it names the missing capability and
links to the participants, where one who has it can be added.

In Scrum, for example: the *Product Owner* — a person or an agent — orders the backlog and decides what is released; the
*Scrum Master* — either — watches the process, removes obstacles and approves nothing; the *Developers* — either, able to
write to the repository and to run code and tests — turn items into a done increment.

A role that needs a person must have one before a role assignment can be saved. A participant that processes data at a
place a linked requirement source does not permit may still hold a role, but that source's content is never given to it.
In the book *Vibe Coding*: chapter 7, section 5, for the roles of Scrum.

## fill-the-roles

The process names roles and no one; the product's role assignment fills them with participants of this instance's list,
so who does the work can change without the process changing. A role is a defined responsibility in the process, such as
developer, reviewer, tester or product owner, and one participant may hold several roles in a small project.

Only Scrum has teams. A Scrum team — its Product Owner, Scrum Master and Developers — is one filling of Scrum's roles, and
plans and runs sprints of its own; several teams of one product, at work at the same time, are what the book calls
agility at scale. Kanban is one flow under a limit on the work in progress, and the V-model pairs each step down to the
code with the step that verifies it on the way back up; neither knows a team, so a product in either has one role
assignment, with as many developers, testers and reviewers as the work needs. In the book *Vibe Coding*: chapter 6, the
Geek Box *Artifacts, roles, and traceability*, for what a role is, and the V-model; chapter 7, Figure 7.4, for the Scrum
team, Kanban, and *Scaling Agility to Large Systems* for several teams.

## role-assignment

A role assignment, `docs/role-assignments/<name>.md` in the product's repository, gives each role of the process its
participants, and holds nothing else. In a model that works in sprints, each team has one, and a participant may serve
several teams; in any other model, the product has one. Beside it stand the findings of the role assignments read
together. A team is removed only while no sprint of it holds an item: an item stays held until its change reaches the
default branch.

## assign-participants

Name the role assignment — in a model that works in sprints, the team, such as `team1` — and tick who fills each role:
one participant for a role that one fills, as many as the work needs for a role that several may fill. *Save* commits
the role assignment to the product's repository as your own commit, and nothing else. It stays disabled while a role
that needs a person has none, or a role that one fills has more, and the role is named. Jobs already running keep their
participant.

## phases-and-gates

The phases are the stages the work passes through, in the model's order; a transition leads from one phase to the next,
or back to an earlier one. A verification pair names the phase that checks what another phase produced — in the V-model,
for example, *Testing* checks the *Design*, and *Validation & Verification* the *Requirements*. A gate stands between two
phases: it names the artifacts that must exist and the condition that must hold before the next phase opens, and who
decides it — a role, held by a person or an agent, or an automated check such as CI. A job that reaches a gate waits
there until its decider has decided, and no gate is passed by the decision of the participant whose work it checks. In
the book *Vibe Coding*: chapters 6 and 7.

## branch-of-its-own

A phase, or a sprint, may have a branch of its own. The work done in it is then merged into that branch instead of the
default branch, and merging that branch into the default branch is the gate at its end — in Scrum decided by the Product
Owner after the review of the sprint's increment. The work of the phase or sprint reaches the default branch only through
that gate. Preset is *none*: the work of every job is merged into the default branch. In the book *Vibe Coding*: chapter
12, section 10, on a branch merged back through a reviewed pull request.

## practices

A practice is added to the declared model and never replaces it: DevOps, prototyping, incremental delivery or a scaling
layer. Each says what it adds and which models it fits — DevOps and the scaling layers fit Scrum and Kanban; prototyping
and incremental delivery fit every model of the catalogue. A product may add none, one or several. In the book *Vibe
Coding*: DevOps and the scaling layers in chapter 7, prototyping and incremental delivery in chapter 14.

## process-requirements

Some requirements constrain how the product is built rather than what it does — for example IEC 62304 class B, which asks
that unit verification is documented. They come from a registered requirement source, like every requirement, and they
add gates and artifacts to the workflow of the chosen model, each marked with the requirement and the source it comes
from; they never replace the model. Where such a requirement needs a gate the model does not have — documented
verification before a release, say, in a Kanban flow without a release gate —, the gate is added and its place shown, and
the model stays what it is. A product without process requirements shows none here; once requirements from a standard are
accepted, their additions appear without the model changing.

## definition-of-done

The Definition of Done names the conditions a pull request must meet before it is merged. It is preset to the rules every
implementation job already follows: CI is green; the job's first commit held only failing tests — for a refactoring job,
CI was green on every commit and no expected result changed —; only the job's modules changed; and every gate before the
merge is recorded. You may add conditions, for example a review by a second developer, a CI check of its own, or a gate.
In Scrum, the Developers meet the Definition of Done, whoever presses merge. In the book *Vibe Coding*: chapter 7,
section 5, after the Scrum Guide.

## process-declaration

*Save* writes the declaration — the model, the holders of its roles, the practices, the branches and the Definition of
Done — to `docs/process.md` in the product's repository, as one commit under your own account: what you decide here is
your own input, and needs no further acceptance. The model's version is the commit of this instance its catalogue was read
at; the product keeps that version until its declaration is saved again. Choosing another model later deletes nothing:
the page lists the artifacts the new model no longer requires.

## repository

A *repository* is the folder on GitHub — or on a GitLab server — that holds a project's files and their whole history of
changes. Paste the product repository's address exactly as your browser shows it when that repository is open, for
example `https://github.com/alice/thesis-tool` or, for a project on a GitLab server, that project's address with every
group it sits under, for example `https://gitlab.rrze.fau.de/fau-ai-taskforce/tools/thesis-tool`. Agent M reads the
address alone to tell whether the repository is on GitHub or on a GitLab server. The product's requirements, use cases
and architecture will live in that repository; this dashboard only reviews them there — it keeps none of that content
itself.

## product-key

The product gets a key of its own, separate from the key this Agent M instance itself uses: a key that reaches only this
one product cannot write anywhere else, and GitHub limits a key to the repositories of one owner, so the instance's own
key could not also reach a product of another owner. GitHub has no way to preselect a repository through a link, but
Agent M opens the page for a new key with the product's owner, a name and a description already filled in from the
product's address, and every permission the product needs already checked — on that page you only choose the product's
repository, press *Generate token* and copy it. On a GitLab server the equivalent is a project access token, created on
that project's own Access tokens page and scoped to that project alone. Either way, the key is kept in this browser for
this product only and sent only to that product's own server, in the requests for this product; Settings shows it,
tests it and can clear it.

## review-layout-commit

Pressing *Add product* writes one commit into the product repository's default branch: a short `README.md` in each of
the folders Agent M uses that does not hold one yet (`docs/use-cases/`, `docs/architecture/`, `docs/approvals/`,
`docs/spec-freigaben/`), a `SPEC.md` skeleton that says what a requirement is and holds none yet, and a `CHANGELOG.md`
with its title — only whatever of this is missing; nothing already there is overwritten. The product's address is then
added to this browser's own list; nothing is written anywhere else.

## reverting-the-commit

The commit that adds the missing layout is an ordinary commit on the product repository: you can open it on GitHub — or
on GitLab — like any other, and revert it from there if you no longer want it; nothing about it is special to Agent M.
If the product repository already has the complete layout, nothing is committed in the first place, so there is then
nothing to undo.

## the-product-list

The product's address is kept only in this browser's own storage, beside its key — nothing is written into the
instance repository, and no product is named there. So a fork of Agent M never shows which products you work on, and it
can be kept in sync with upstream without conflict. Another browser, or another computer, starts with an empty list:
add the product there again with *+ Add product* — for one that already has its layout, that is its key in Step A,
*Check* and *Add product*. *Clear everything* in Settings removes the list together with its keys.

## release-test-levels

*Start release candidate* runs the product's complete test suite, at every level, on exactly the commit marked as the
release candidate: *unit* and *component* tests, fast and with paid external services mocked; *system* tests, which
walk each use case end to end; *integration* tests against the real external services, the run that otherwise happens
only nightly; and *release* tests, one or more for each requirement, written by a participant other than the one who
implemented the behaviour they check. The release panel then shows every level with its result, each model-dependent
check as a rate against the version currently running, and every requirement beside the evidence that guards it.

## independent-release-tests

Release tests are written by a participant other than the one who implemented the behaviour they check — never by its
own author. Someone who built a piece of behaviour tends to test what they already thought of while building it; a
different participant reads the requirement itself and is more likely to find what the behaviour still gets wrong. If
only the implementing participant is available, Agent M says so and asks you to assign a second participant, or to run
the release tests yourself.

## version-not-rewritten

Once a version is tagged, that tag is never moved to a later commit, and the release it names is never changed
afterwards: the tagged commit is exactly the one the complete test suite ran on, at every level, so the tag always
points to a state that can be recovered, compared and relied on later. If the tag for a version already exists, the
release stops instead of moving it; a correction becomes the next version rather than a silent change to one already
released.

## endpoint-url

The endpoint URL is the web address of the model service that will answer the short test request. Paste the address the
service gives for its API, including its `https://` at the start when the service provides one. Agent M uses this URL only
for the endpoint you configure here; it does not put the address or a key into a link, a browser cookie or a repository.

## endpoint-kind

Choose whether this endpoint speaks the OpenAI-compatible or Anthropic API. The choice tells Agent M which request shape
the endpoint understands; it does not select a model or send a request by itself. A provider's documentation names which
kind its endpoint accepts.

## endpoint-model

The model is the name the chosen endpoint expects in a request, for example the name shown in its own model list. It is
not a download and does not make Agent M call the model until you press *Test*. If the endpoint says that name is not
available, change it to a model the endpoint offers.

## endpoint-key

Some endpoints need a key and others do not, so this field is optional. When there is a key, Agent M keeps it in this
browser's localStorage with this endpoint configuration and sends it only in the authorisation header of a request to
that endpoint. It is never placed in a URL, a cookie or a repository. A refused key stays stored until you replace it or
clear the configuration.

## endpoint-declaration

An endpoint is offered for conversations about a page only when it declares where it processes data — the provider and
its country, or *this machine* — and how many tokens its model's context holds; that place is named before a message is
sent. The CI secret is the name of a GitHub Actions secret of the repository that holds the endpoint's key, never the key
itself. An endpoint that names a CI secret and keeps no API key in this browser runs through GitHub Actions: the button
that sends then reads *Spawn job*, and each message becomes a job on GitHub's runners, which call the endpoint with the
key from that secret. An endpoint that does not accept calls from a web page — it sends no cross-origin permission — can only run that
way or through a Bridge.

## endpoint-route

For an endpoint that the browser can reach, choose the direct route. For a model server on this computer, choose the
Bridge route instead: the paired Bridge calls the local model and the browser talks only to the Bridge. The Bridge's
pairing and HTTPS handoff are configured in UC-044; the local model does not need browser CORS permission. Until that
Bridge setup is present, Agent M keeps this choice and names the setup that is still needed instead of testing the model
directly.

## endpoint-test

Press *Test* after saving the URL, kind, model and optional key. Agent M stores that configuration in this browser first;
one short test request is sent only to the endpoint you named, and an optional key travels only in that endpoint's
authorisation header. The request does not go to a repository, another web page or a cookie. If the endpoint refuses a
browser request because it lacks a cross-origin permission or opt-in header, use GitHub Actions or the local Bridge;
Agent M shows the reason rather than treating the configuration as working.

## endpoint-clear

*Clear* removes this endpoint configuration and its key from localStorage, not only from the form on screen. Agent M then
confirms that nothing is stored for the endpoint in this browser. Add the URL, kind and model again before a later test.

## bridge-pairing

The token shown by the Bridge pairs this dashboard with this Bridge. Copy it only into the dashboard that belongs to this
instance; it authorises that dashboard to ask this local app to reach services on this computer. It is not a model key and
is never put into a repository, a link or a cookie.

## accepting

Accepting is a commit made under your own account, so Git records who accepted and when; a commit is one saved change to the
repository. The commit adds an *approval record*, a small file under `docs/approvals/` that names the file you accepted and the
blob SHA of exactly the text you were shown. Several files can be accepted at once: one commit then holds one approval record
per file, each naming the text you were shown, and a file that changed after it was shown is left out and named. Accepting a
change to the SPEC also replaces the SPEC section with the proposal, byte for byte, and adds the decision to the queue. In the
book *Vibe Coding*: chapter 12, section 10.

## rejecting

Rejecting turns a proposal down, with the reason you type; without a reason nothing is written. The dashboard makes one commit
under your own account, with your reason in its message, so Git records who rejected, when and why. A use case, an
architecture decision or a module file goes back to the text it had when it was last accepted, or, if it was never accepted,
leaves the repository. A SPEC change entry leaves its queue, with its rationale and its row of the queue's index; a queue
whose last entry leaves goes with it. No approval record is written, and the SPEC is not touched. If the text changed after
it was shown, nothing is written and the page shows it as it is now. The history of the repository keeps every rejected text.

## blob-sha

A blob SHA is the number Git computes from the content of a file: the same text always gives the same SHA, and any change to
the text, even one character, gives another. An approval record names the file and the blob SHA of the text you saw, so it is
about that text and no other. The editor notes the SHA of the text it opened, and *Save* compares it with the file on the
branch: if that has another SHA, nothing is written.

## edit-after-acceptance

An approval record names the accepted text by its blob SHA. When the file is edited afterwards, by you in the editor or by
anyone else, the new text has another blob SHA, and no approval record names it. So the dashboard shows the file as *changed
since acceptance*, and nobody has to reset a status: whether a file counts as accepted is worked out every time from the
records, and a record can only vouch for the text it names. Above the text, the dashboard shows the difference to the text the
most recent record for this file names, so that you read only what changed and can accept the new text as before. In the book
*Vibe Coding*: chapter 12, section 10.

## spec-edit-waits-for-approval

The SPEC is what the use cases, the architecture, the tests and the releases are checked against, so a change to it is a
decision, and the dashboard never writes it straight into SPEC.md. Saving an edited requirement writes a proposal into a change
queue under `docs/spec-freigaben/`. A reviewer sees the proposal beside the current text and accepts it, and only then is it
written into the SPEC. A use case is different: it is a draft to be read and corrected, so its file is saved at once. It is
open, not accepted, until an approval record names the saved text, so nothing relies on it before someone has accepted exactly
that text. In the book *Vibe Coding*: chapter 8, section 6.

## change-queue

A change queue is a folder under `docs/spec-freigaben/` that holds proposed changes to the SPEC. Each *entry* is one SPEC
section as it is proposed; the queue's `index.md` lists the entries in order, and `entscheidungen.md` records each decision as
it is taken. An entry is open until someone accepts it. The edits you save on the dashboard collect in your newest queue of the
day that has no accepted entry yet. Entries of one queue that are accepted together are written in the order of the queue's
index, in one commit; an entry whose heading another entry creates is offered only together with or after that entry, and the
dashboard names the entry it waits for. In the book *Vibe Coding*: chapter 8, section 6.

## github-page-without-token

With a token, a key you create on GitHub and store in this browser, the dashboard makes the commit for you, under your
account. Without a token it cannot, so it opens GitHub's own page instead, prepared as far as GitHub allows: to accept,
GitHub's page for a new file with the approval record filled in; to edit, GitHub's editor, with your edited text on the
clipboard; to reject, GitHub's page that deletes each file, or its editor with the text to paste, and your reason to use as
the commit's message — one commit per page, since each of GitHub's pages changes one file. The link carries at most the file's path and the record, never the text you reviewed. You press *Commit changes*
there, and the commit is yours as before; then reload the dashboard. Without write access to the repository, GitHub makes your
commit a pull request, a proposal for the maintainers to review, and the change counts once a maintainer merges it. If the
record does not arrive filled in, the dashboard shows it with a copy button and the exact path of the file. On a GitLab server
there is no such page, so the dashboard needs the project's own token there. In the book *Vibe Coding*: chapter 12, section 10.

## requirements-to-cover

The requirements to cover are the requirements the drafted use cases should realise. By default they are all the requirements
that no use case realises yet, so a first run covers what is still uncovered; you can change the selection to cover fewer
requirements, or other ones.

## drafting-participant

The participant is the model or agent that writes the draft. The dashboard offers only participants from this instance's list
that are declared able to draft text, and next to each it shows where it processes data, because whatever is sent goes to that
place. Choose one whose place you are content with; nothing is sent until you press *Run*.

## run-panel

The run panel appears before anything is sent. It names every participant that will receive something, where it processes
data, and exactly what it receives, part by part, with the size of each part against how much the participant's context can
hold: the requirements to cover, every existing use case, a chapter of the book on requirements engineering, and the prompt.
If the whole does not fit, nothing is sent, the panel says how much there is and how much fits, and you can choose a
participant with a larger context; nothing is left out silently. *Run* is the one click that sends.

## correction-loop

Before you see a draft, Agent M checks it without a model: each use case needs its five parts, a diagram, and realised names
that match real requirements. Every finding is sent back to the participant as one line, like a message from a compiler, naming
the file and line, whether it is an *error* or a *warning*, the rule and the correction expected. An error must be fixed; a
warning is fixed or kept with a one-line reason. This repeats until the draft passes, until the limit of rounds shown on the
run panel is reached, or until a round changes nothing. The number of rounds is counted and shown with the draft, and any
finding left over is shown beside it for you to deal with.

## drafted-use-cases

Drafted use cases are written as one file each in `docs/use-cases/`, on the default branch, and each is *open*: a proposal,
not yet accepted. Nothing relies on a use case until you accept it. You review and accept each use case on its own, in the
review of use cases, which writes an approval record for exactly the text you read.

## draft-difference

The difference shows the draft against the current text, line by line: lines removed on one side, lines added on the other, so
that you read only what changed. A name dropped from the list of realised requirements shows up in it too; that is not an
error, it may be what you wanted. You can edit the draft freely, or give a follow-up instruction to refine it, before you save.

## save-use-case

*Save* is one click. For a use case it commits the file to the default branch as *open*, not accepted, so the saved text is
the draft you edited. The commit records the instruction, the participant, its model, the Agent M version, the date and how many
correction rounds the draft needed. If the file changed while the participant was drafting, nothing is written and your draft
stays in the editor beside the newer version.

## ci-agent-draft

A CI agent is a participant that runs in a GitHub Actions workflow, so nobody is waiting at the dashboard while it drafts. The
workflow runs the same correction loop, then commits the draft to the default branch: a use case as *open*, and a change to
requirements as an entry in a new change queue, leaving the SPEC itself untouched. You review it afterwards on the dashboard,
a use case in the review of use cases and a queue entry beside the current SPEC section. Nothing counts before you accept it.

## participant-person

A person is a colleague, reached through their GitHub or GitLab account and through the dashboard. They can do everything, and
only a person takes the decisions that need one. Nothing is billed for a person and nothing is sent to a model, but a person
works at the speed of a person; you control the work by doing it yourself.

## participant-model-endpoint

A model endpoint is a language model that you reach over the network, for example the NHR hub, an OpenAI or Anthropic
endpoint, or a model server such as Ollama that you run yourself. It drafts text and nothing else: it cannot read or change a
repository. It answers quickly, and a hosted endpoint is billed per use by its provider, while a model you run yourself costs
you the machine. You control which model answers and, for a hosted one, where your data is processed. The browser reaches it
directly, or through a Bridge the configuration names.

## participant-ci-agent

A CI agent is an agent that runs inside a GitHub Actions or GitLab CI job, so it is reached through a workflow. It can read
and write the repository and run code and tests. On GitHub's machines it needs nothing installed, but each call is billed per
use by the agent's provider and a job takes the time of a workflow run. On a self-hosted runner, a program you install on a
machine you control, it runs on your own machine and you control more of it.

## participant-cli-agent

A CLI agent is a coding agent such as Claude Code or Codex that runs on a computer of yours, reached through the Bridge on that
computer. It can read and write the repository, run code and tests, and use tools. It signs in with its own login on that
computer, so the work uses your subscription instead of a key billed per call, and it starts at once. You control it the most:
the work happens on your machine, in a working folder of its own.

## participant-sandboxed-agent

A sandboxed agent is a CLI agent inside a virtual machine or a container, reached through the Bridge in it, over a tunnel. It
can do what a CLI agent does, but isolated: it sees only what the sandbox holds. You control it by what you put in the sandbox,
so it is the choice when the agent should not touch the rest of your computer.

## coding-participants

A coding participant writes a job's tests and then its code. Only a holder of the implementing role that declares *write to
the repository* and *run code and tests* is offered, each with the place where it processes data. There are three kinds, and
they differ in setup, speed and isolation.

A CLI agent, such as Claude Code or Codex, runs on a computer of yours and is reached through the local Bridge on it.
Setup: the Bridge runs on that computer, and the agent signs in with its own login there, so no key is needed and your
subscription pays. Speed: it starts at once. Isolation: the work happens on your machine, in a working folder of its own.

A sandboxed agent is a CLI agent inside a virtual machine or a container, reached through a tunnel to the Bridge in it.
Setup: the Bridge runs inside the sandbox, and the tunnel reaches it. Isolation: it sees only what the sandbox holds, so
it is the choice when the agent should not touch the rest of your computer. The texts of Agent M give it no speed of its own.

A CI agent runs in a workflow on a self-hosted runner on the agent's machine. Setup: you install a self-hosted runner, a
program, on that machine; the workflow's job then reaches the agent locally, with no inbound SSH and no key stored on GitHub,
and the runner only connects out, so a machine behind NAT works too. Speed: a job takes the time of a workflow run.
Isolation: the job runs on that machine, and a self-hosted runner serves private repositories only.

## capabilities-and-place

Capabilities say what a participant can do: draft text, read the repository, write to the repository, run code and tests, use
tools, reach the web. The dashboard presets the ones typical for the type and you adjust them. A role can only be held by a
participant that has every capability the role needs. The processing place says where the data given to the participant is
processed, for example *this machine* for a CLI agent. It matters because a linked source may permit its content only at
certain places: a participant elsewhere can still be saved, but is never given that source's content.

## ci-agent-runner

A workflow runs on its runner, on GitHub's machines or on a machine you installed a runner on, and not in this browser. So
nothing stored in this browser, neither a token nor an SSH key, reaches it; its key is an Actions secret that you set on
GitHub. To let a workflow use an agent on your own machine, install a self-hosted runner on that agent's machine. The workflow's
job then runs there and reaches the agent locally, with no inbound SSH and no key stored on GitHub, and it also works for a
machine behind NAT, because the runner only connects out. A self-hosted runner serves private repositories only: on a public
repository a pull request from any fork could run its own code on your machine, so the dashboard refuses a public one and says
why. Since a participant may serve every product of the instance, this holds for each product that would use it.

## ci-ssh-alternative

If you do not want a self-hosted runner, a workflow can reach an agent behind SSH instead. That costs two things: the SSH key
has to be stored as an Actions secret on GitHub, and the machine has to be reachable from the internet by GitHub's machines.
The runner is the recommended way, because it needs neither.

## agent-test

The test sends a harmless request through the Bridge the participant names and shows what answered, so that you know the
connection works before you save. If the Bridge does not answer, the dashboard names the reason, such as the Bridge not running,
a wrong address or a missing token, and saves nothing until you decide to save it untested.

## job-workflow

Agent M's job workflow is the workflow in the product repository that runs a job on GitHub's machines. It reads two secrets
that you set on GitHub as Actions secrets: the key of the agent or endpoint, and your Agent M token. The dashboard names each
secret and opens the repository's secrets page for it, but never asks for the value. The token is there so that the job's
pushes and pull requests start CI like your own; the workflow's built-in token would not. The agent's calls are billed per use
by the agent's provider. In the book *Vibe Coding*: chapter 10, section 6, on API tokens.

## bridge-own-login

A job handed to a Bridge runs on your computer with the agent's own login and with the computer's own git login. No key is
stored for it on GitHub; the job uses your subscription. The computer's git login must reach the
instance and the product, and the Bridge refuses the job and names the repository when it does not.

## bridge-https-route

Some browsers block the call to the Bridge's local address, `http://127.0.0.1`, as Safari does. The site then says why and points
to the other route: the Bridge reached over HTTPS through the jump host. Use that route when your browser blocks the local
address. The same route reaches a machine behind NAT.

## bridge-levels

Agent M runs on two levels. **Level 1** needs nothing installed: jobs run in this browser and in GitHub Actions or GitLab CI on the server's machines, a coding agent signs in with an API key stored as a CI secret and is billed per call, and mail works with Microsoft 365. **Level 2** is this app, the Bridge: jobs also run on this computer and on machines reached through it, a coding agent uses its own login on this computer, so your subscription pays, and mail also works with Gmail and any other IMAP or SMTP server. Level 2 needs the Bridge and the agent's command-line version (Claude Code, Codex or opencode).

## bridge-signed-warning

The Bridge is one file for your system, signed by the publisher of the release. Your system shows the publisher's name when you open it: check that it is the publisher this page names. On Windows, SmartScreen may still warn about a newly signed release until enough people have downloaded it; the file is not changed by that, only not yet known to SmartScreen. If the publisher's name is the one you expect, choose **More info**, then **Run anyway**. If the name differs, do not run the file.

## bridge-install-agent

The window lists the coding agents it supports (Claude Code, Codex and opencode). For an installed one it shows its version and *ready*. For a missing one it shows **How to install**, which opens the vendor's own instructions for your system; install it there, then choose **Check again**. Agent M installs nothing in your name. A local agent uses its own login on this computer, so no key is entered here and your subscription pays. If an agent is installed but not signed in, the window says so and shows the agent's own sign-in step; it never asks for your password.

## bridge-jump-host-key

The jump host is a machine you can reach by SSH, through which a computer behind a firewall (NAT) is reached from elsewhere. Enter its hostname and your user on it. On first use the Bridge creates its own SSH key and shows only the **public key** here. Add that public key to `~/.ssh/authorized_keys` of your user on the jump host, or give it to whoever administers the jump host. The private key never leaves this computer, and Agent M never asks for it.

## bridge-tunnels

A tunnel is a connection the Bridge opens itself, so you type no command. A reverse tunnel carries your computer's Bridge out to the jump host and listens there on the jump host's loopback only, so nobody else on the network can reach it. The Bridge keeps the tunnel open and reconnects after sleep or a change of network. The window shows *tunnel open*, or the reason it is not. A matching forward on your own computer is opened the same way by a Bridge there; without a Bridge there, the dashboard shows the two commands to run.

## bridge-import-export

Instead of typing the jump host, import the settings export from the dashboard. Export and import are on the dashboard's settings page; the file may be locked with a passphrase. If the export names the jump host and this Bridge, with its name and its port on the jump host, the window takes them from it. The export contains secrets, such as the pairing token, so keep it as you would a password and delete it when it is no longer needed. Importing reads the file into the Bridge's window and writes nothing to any repository.

## bridge-updates

When a newer release exists, the Bridge shows it with its release notes. **Update** installs it only after your click, and only if its signature is valid. Nothing is updated behind your back.

## source-kinds

A source is where rules come from, and the library keeps four kinds of them. An *EU legal text* is a law or regulation of the
European Union, for example the AI Act: you paste its EUR-Lex or ELI address and Agent M recognises the number in it. A
*standard* is a norm published by a standards body, for example IEC 62304: you enter its full designation. *Documents* are
files you have, PDF, Word or Markdown files or a zip file holding them, for example a customer's requirements specification.
A *repository* is a repository on GitHub or GitLab, public or private, for example a project's guidelines kept in Git. Choose
the kind that matches what you have; the rest of the form follows from it.

## source-name

The name is how the library and the products that link the source call it, for example *AI Act* or *IEC 62304*. Choose a name
you would recognise in a list, since it is shown wherever the source is linked. If the source is already in the library, do not
register it again: add a new version of the existing one.

## source-authority

Authority says how much the source binds. *Normative* means its rules must be followed, for example a law or a standard you must
comply with. *Advisory* means they are recommended, for example a guideline. *Informational* means they are background that
helps you understand, for example a handbook. A normative source does not win automatically when it contradicts something in a
product: a person still decides, because the product may be out of that source's scope.

## source-licence

The licence says whether the source's content may be republished. *May be republished* is for texts such as EU law or openly
licensed guides: their content is stored in the public instance beside the register entry. *Restricted* is for content such as a
bought norm or internal documents: it is kept in a repository you name, never in the public instance. If you do not know the
licence, the source is treated as restricted until someone records it.

## standard-designation

A standard is registered by its full designation, and that includes the edition and its amendments, for example
`IEC 62304:2006+AMD1:2015`. You find it on the norm's cover page, next to the title: the number, the year of the edition after the
colon, and any amendments added with a plus sign. The amendment matters because an amendment changes the text of the norm, so a
requirement taken from the edition alone may differ from the one the amended norm states; the full designation says exactly
which version was used. The licence of a standard is preset to restricted.

## file-only-hashed

If you only have a printed or local copy of a norm and do not want to upload it, select the file anyway. Your browser computes the
file's SHA-256, a fingerprint of its exact content, without sending the file anywhere. Only the designation and that hash are
recorded, with a note where your copy is kept, so the text itself is not stored. Anyone holding the same copy can compute the
hash and check that it is the version that was used.

## source-public

Before you save, Agent M states what becomes public, because the instance is a public fork. The register entry always becomes
public: the name, kind, authority, licence, versions, identifiers and hashes. The content becomes public only if its licence
says it may be republished; restricted content goes to the repository you name, and it is public only as far as that repository
is.

## source-new-version

A new version is a newer edition or revision of a source that is already in the library: a law that was amended, a norm that got its
next edition, a document that was revised, a repository that has moved on. Choose + New version and give the version a name that
tells it apart, such as the edition or its date. What the version records depends on the kind of source:

- *Documents and standards*: select its files. Your browser computes each file's SHA-256, a fingerprint of its exact content, and the version records the files with their fingerprints.
- *A repository*: select no file. The version records the commit the repository stands at when you save; a commit is GitHub's record of one change, kept in the history. No file of the repository is stored.
- *An EU legal text that was fetched before*: select no file either. + New version starts the fetch run for the entry, which records the newer text it fetches as a further version; the same text is not recorded again.

The new version is added beside the old versions, which are never overwritten: the library keeps every version as it was, so a
product can still say exactly which one it used. Saving makes a commit to the instance repository under your own account, and the
files go to the repository the source names where its licence is restricted. Files with exactly the same bytes as an existing
version, or for a repository a commit that an existing version already records, are refused, and nothing is recorded. Products stay
on the version they link until you move them.

## source-move

Moving a product changes which version of the source the product links. Each product keeps a list of the sources that apply to it
in its file docs/sources.md, with the version it uses; a product that links an earlier version stays on it, for example because it
was certified against it, until you decide otherwise. When you choose Move to the new version, the requirements that name the source
and the passages that changed are shown first, so you can see what the move touches before you decide. Then Move makes one commit to
docs/sources.md of the product's repository under your own account, and nothing else; the commit message names the requirements
listed, so the history shows the move together with what it affects. Without pressing Move the product stays on its version.

## mailbox-routes

There are two ways to connect a mailbox, and your mail provider decides which one you use. The *web API* route is for Microsoft
365 and goes directly from the dashboard: you sign in with the provider's own sign-in, so Agent M never sees your password, and
you register an app with Microsoft once, whose return address is this dashboard. It works because Microsoft allows web pages to
call its mail API. The *IMAP and SMTP* route is for every other mail server, for example Gmail, FAU's Exchange, a university's
IMAP server or a small provider. You give the mailbox password, which is stored in this browser after a notice, and you need a
Bridge running and paired with this browser. It needs the Bridge because browsers let no web page open an IMAP or SMTP
connection. Agent M proposes the route from your mail address, and you can change it.

## mailbox-app-registration

To sign in with Microsoft, you register an app with Microsoft once. The dashboard opens Microsoft's page for a new app
registration and shows what to enter there: the name `Agent M`, the kind *single-page application*, and the return address of this
dashboard, with a copy button. Then you copy the app's client ID back into the dashboard. Many institutions allow this only to
their administrators. If Microsoft refuses the registration, ask the administrator of your institution's Microsoft account, and
tell them what you need: a single-page application with this return address and the three mail permissions. Until it is
registered, the IMAP route can serve in the meantime if your provider also offers IMAP.

## mail-server-settings

For the IMAP route you enter the IMAP server and the SMTP server with their ports. A mail provider usually lists these settings in
its help pages, or in the mail settings of your account, under a heading such as *IMAP* or *server settings*. The dashboard presets
the usual encryption for each port: port 993 with implicit TLS for IMAP, and port 587 with STARTTLS or port 465 with implicit TLS
for SMTP. It also presets the account name as your address. Correct whatever differs for your provider.

## gmail-app-password

Gmail refuses your account password over IMAP. It accepts an *app password* instead: a password that Google creates for one
program. An app password needs 2-Step Verification to be switched on for your Google account, so switch that on first, then create
the app password in your account's security settings, on Google's page
[Create and manage your app passwords](https://myaccount.google.com/apppasswords), and enter it as the mailbox password. Work or school accounts may not offer
app passwords; then the organisation's administrator decides whether you can connect. The same applies when a mail server refuses
the login although the password is right: some providers require an app password instead of the account password when two-factor
login is on.

## mailbox-processing-places

Processing places are the places where the participants of this instance process the data they are given, for example *this
machine*, *FAU data centre (EU)* or *US cloud provider*. You tick the places to which this mailbox's mails may be given. Nothing is
ticked at first: until you tick a place, mails are only read and never handed to a participant. If you tick a place outside the
European Union, Agent M tells you before saving that processing personal data there does not comply with the EU's rules, the GDPR
for transferring personal data and the EU AI Act. You can still allow it, and this connection records that you did. You can change
the places later under Settings, Mailbox, Processing places; a mail already handed to a participant is not recalled.

## what-is-an-architecture

An architecture is the fundamental organization of a system: its components, their relationships to each other and to the
environment, and the principles guiding its design and evolution. Agent M derives it from all the requirements and use cases at
once, so a product's first architecture is drafted in one piece, with no selection. It describes the system down to its modules and
their interfaces, and leaves to the implementation what only an implementation can answer. The *system* is decomposed into
*subsystems*, each with one responsibility, and each subsystem into *modules*. The architecture is written in four kinds of file:
the decision that states the system, with its patterns, subsystems, views and one scenario for every use case; one decision for
each subsystem; further decisions, one for each significant choice such as a format or a library; and one file for each module.
It is described in four views: the *logical* view of the subsystems and their abstractions, the *process* view of how they
interact at runtime, the *development* view of the modules and their folders, and the *physical* view of where each part runs,
tied together by the scenarios. It combines *patterns* from three families: structuring patterns, adaptable-system patterns and
distributed-system patterns. And it follows design principles: divide and conquer, design to test, KISS, YAGNI, DRY, the principle
of least astonishment, the open-closed principle, and developing against interfaces. In the book *Vibe Coding*: chapter 10.

## architecture-reviewer

Before you see the draft, a second participant, the *reviewing participant*, checks it as a whole against the whole SPEC. It is a
participant other than the deriving one and uses another model.
It checks level by level: every use case against the system, whether its scenario is possible with the subsystems and their
interfaces; every subsystem against the system, whether it fulfils the responsibility and offers the interface the system's
decision gives it; and every module against its subsystem. It does not check the modules against the use cases. Each finding
names the file and line, the requirement it concerns and what does not fit, and counts as a warning. A reviewer can be wrong, so
the deriving participant weighs each finding: it corrects what holds and answers what does not hold with the reason. The corrected
draft is checked again, and each repetition is a *round*. Rounds go on until no finding is left, until the round limit is
reached, or until a round leaves the findings unchanged. Findings left over are shown to you with the rounds, each finding beside
the correction or the answer it got, and a finding that only you can decide is shown to you and not sent back. No test and no CI
run checks the draft.

## due-diligence

Before you accept a library, Agent M does a *due diligence*: it looks up the facts about every reuse candidate and every
alternative in the package registry and the source repository. It reads whether the package exists, its licence, the dates of its
releases, its open and closed issues, and its adoption, which is the number of dependents or downloads. Each fact is stored with the
address it was read from and the date, so you can check it. A candidate that is not found in its registry is not proposed: the
name may be invented. If the registry cannot be read from the browser, a participant that can reach the web fetches the facts, and
until then the reuse decision is shown without due diligence and cannot be written. Next to each candidate's licence stands your
product's own. A package with no maintenance and unclear ownership should make you hesitate even if it is widely used. In the
book *Vibe Coding*: chapter 6, section 5, on reuse.

## licence-permits

A licence is the permission under which you may use someone else's software; the licence says what you may do with it and what you
must do in return. Without a licence you have no permission: code is under exclusive copyright by default, and being able to see
or fork it on a code host does not allow you to use it. A *permissive* licence such as MIT or Apache-2.0 lets you use, change and
distribute the software, even commercially, and mainly asks you to keep the copyright and licence notices. A *copyleft* licence such
as the GPL also lets you do that, but asks you to make the source code available, under the same licence, for larger works that use
it. So a licence can restrict how your own product may be distributed. Agent M reads each candidate's licence and your product's
own, from its `LICENSE` file, and marks a candidate whose licence is not known to be compatible; if the licence is missing,
unknown or restrictive, the table says so in its row and you decide. Without a `LICENSE` file in the product, every candidate's
licence is marked *not checked*, and the product's own licence decides which libraries it may reuse.

## linked-version

You choose one of the product's linked sources and, if you like, the part of it to work on. Agent M reads exactly the version that
is linked to the product, never a newer one, and checks the file's hash: the SHA-256, a fingerprint of its exact content, against
the one recorded when that version was registered. If the hash differs, the content changed since it was registered; nothing is
sent, Agent M says so, and a new version of the source must be registered first.

## source-selection

Choose which of the product's linked sources the participant works from; the list shows the version the product links, and the part of the source that applies, if the link names one. Under the source stand the files of that version that are stored, all ticked at first; untick any file the participant need not read. A file that was only hashed, whose copy is kept elsewhere, is not offered, because Agent M cannot read it. Nothing is sent until you press *Run*.

## existing-requirements

Candidates are drafted against the requirements the product already has, not beside them. So Agent M collects every existing
requirement of the product, those in its SPEC and those in its open change queues, and sends them with the excerpt of the source,
chapter 8 of the book *Vibe Coding* and the requirement prompt. The participant has to hold all of it: if the excerpt, the
requirements and the chapter do not fit into its context, nothing is sent, Agent M says how many requirements there are and how
much fits, and you can choose a participant with a larger context or a smaller part of the source. No requirement is dropped
silently.

## derivation-run-panel

The run panel appears before anything is sent. It names the destination, the participant that will receive the request and where it
processes data, and says exactly what is sent: the excerpt of the source and the existing requirements, with the chapter of the
book, and how many requirements are included. It also states the limit of correction rounds. *Run* is the one click that sends;
if you do not press it, nothing is sent.

## candidate-classes

The participant returns candidates, and each has a class that says how it relates to the requirements the product already has.
*New*: nothing existing covers it. *Change*: it alters a named existing requirement. *Duplicate*: it restates a named existing
requirement. *Conflict*: it contradicts a named existing requirement. A candidate whose name or normalised rule equals an existing
requirement's is classified as a duplicate by Agent M without a model, whatever the model said. The review panel groups the
candidates by class, each beside the requirement it refers to, and you can move a candidate to another class, for example from
*new* to *duplicate* of a requirement.

## candidate-correction

Before you see the candidates, Agent M checks them without a model and sends what it finds back to the participant, one line each,
like messages from a compiler. A candidate that lacks one of the four fields of a requirement, its name, its source, its rule or
its check, is an error and must be fixed; a rule that contains a conjunction is a warning: split it, or give a reason. The participant corrects them, up to the limit of rounds the
run panel states. Conflicts are never sent back, because a person decides them. What is left after the last round is shown flagged,
and the rounds are counted and shown with the candidates.

## conflict-and-normative-source

A conflict is a candidate that contradicts a named existing requirement. Agent M never settles one: it is not sent back to the
participant, and you decide how each is resolved. When a conflict involves a normative source, the panel says which side is
normative, but a normative source does not win automatically, because the product may be out of that source's scope. A conflict
you have not decided stays in the panel and is not written.

## write-proposals

*Write proposals* is one click. Agent M writes a new queue under `docs/spec-freigaben/`, whose entries are open until someone
accepts them: for a new candidate, an entry that adds the requirement to its section; for a change, an entry for the section that
holds the requirement, changing it under its name, with the current text beside it and its impact list; for a duplicate, an entry
that adds the new source to the existing requirement; for a conflict, an entry only as you resolved it. Every entry records the
Agent M version, the participant, the model and the date. The SPEC itself is unchanged until you accept entries.

## prompt-bar

The prompt bar is where you talk to a participant about the page you are looking at: you write what you want, and the
participant is given the page as it is shown. Each message goes only to the participant named above the input, at the place
where that participant processes data, and that place is named with it before you press *Send*. The conversation stays in this
browser tab; it is written to a repository only while recording conversations is switched on in the instance's settings. A draft
or an edit the participant proposes changes nothing until you save it. Work this tab cannot do is handed over only when you click *Hand over*; that is
work such as running code or tests, changing code or reaching the web.

Examples of what to ask: split a requirement into two; make a rule checkable; add an alternative flow to a use case; align a use case with a requirement that has changed.

## recording-conversations

*Recording conversations* decides whether the conversations of the prompt bar are written to git. It is off unless you switch it on.

While it is on, every message of a conversation, yours and the participant's, is committed under `docs/conversations/` of the repository of the page the conversation is held on: the instance's own repository for a page of the instance, the product's for a page of a product.

A repository that its server reports as public publishes what is committed to it, so the conversations held on its pages are published too. Before you switch it on, the page names each repository it reports as public; for a repository whose visibility it cannot read, it says *visibility not known*.

Switching it off is saved at once. Records already written stay in the history of the repositories; switching off writes no more and removes none.

## new-repository

The product needs a repository to live in, and the server creates one on its own page for a new repository, which the link opens in a new tab. Agent M creates nothing there: you make the choices, then come back, continue at the address and press *Check* again. On GitHub the page asks for these choices:

- *Owner* — the account or the organisation the repository belongs to. Choose the one that should own the product; the address you paste here starts with it, and you need permission to write to it. The product's key (Step A) is made for the same owner.
- *Repository name* — the last part of the address, in lower case with hyphens, for example `thesis-tool` in `alice/thesis-tool`. The key's name is built from it.
- *Description* — optional; one line for people who find the repository.
- *Visibility* — a public repository can be read by anyone, and everything Agent M writes into it — requirements, use cases, architecture — is published; a private repository can be read only by you and the people you invite. Choose a private repository where the product holds what it should not publish. Visibility can be changed later in the repository's settings.
- *Starter files* — a README, a `.gitignore` and a licence are offered; all three are optional. Agent M writes the folders and files of its review layout that are still missing and overwrites nothing, so you may start empty or with any of them.

On a GitLab server the page is the one for a new project and asks for the same choices under other names: the project name, the group or user it sits under (its owner), a visibility level of *Private*, *Internal* or *Public*, and whether to start with a README. The advice is the same.

## setup-key

A *token* is a key you create on GitHub and give to this page, so that it can make commits for you — only in the repositories you select, only with the permissions Agent M's features need, and only until the date you choose. You can delete it on GitHub at any time; it then stops working immediately.

Why *Only select repositories*? GitHub preselects All repositories, which would let this page write to every repository you own. Choosing only the instance limits the key to what Agent M actually needs; each product you add later gets a key of its own.

## setup-key-permissions

One key serves every feature, so the prefilled page asks for these permissions:

- Contents (read and write) — to save and accept.
- Issues (read and write) — for reports that become issues.
- Pull requests (read and write) — for the jobs' changes.
- Actions (read and write) — to start a run.
- Workflows (read and write) — for a generated CI configuration.
- Secrets (read and write) — to store an endpoint's key as a GitHub Actions secret.
- Metadata (read) — to read the repository.

## setup-store

The token is kept in this browser only, in its `localStorage` — never in a cookie, never in an address, never in any repository. It is sent only to GitHub's API, as a header, to read the instance. Another computer or browser does not have it: Import settings moves it there from an export. Settings shows the token, tests it and clears it.

## requirement-sources

The rules your product has to meet come from *requirement sources*: a law, a standard, a customer's specification. This page lists which of them apply to this product. Three differences help to read it.

| | The library | This list |
|---|---|---|
| answers | which sources exist at all | which sources apply to this product |
| kept in | the Agent M instance, for every product | this product's repository, in `docs/sources.md` |
| you decide | when you register a source or a new version of it | which sources to tick, in which version, and to which part |

**A source is not a resource.** A source is a rule the product must meet, such as the EU AI Act or IEC 62304 class B. A resource is something the product is built with or run on, such as a private repository of libraries, a model on Hugging Face, a compute cluster or an endpoint; resources are declared elsewhere and are not linked here, see [UC-040](#use-case/id=UC-040). If a resource comes with terms the product must meet, such as a licence or a usage policy, register those terms in the library as a source and link them here.

**Why the version is fixed.** A law is amended and a standard gets a new edition, and a requirement drawn from an older text may no longer hold. So each link records the exact version of the source the product uses, and the fingerprint (SHA-256) of that version. The product moves to a newer version only when you decide to, and Agent M lists the requirements it affects first.

The *part* says which part of a source applies, such as a safety class, a chapter or a set of articles. Leave it empty when the source applies as a whole; any text is allowed. A source whose content is restricted can be linked like any other: only reading its content needs access.

## settings-bridge-stored

This browser keeps the Bridge address and pairing token so it can reach the Bridge. Anyone able to read this browser's Pages storage can read them.

## settings-bridge-named

This browser keeps the Bridge's address, or its port on the jump host, and its pairing token under the name the Bridge reports. Anyone able to read this browser's Pages storage can read them.

## settings-jump-host

This browser keeps the jump-host connection details so the Bridge can prepare remote sessions. Anyone able to read this browser's Pages storage can read them.

## settings-export-import

Export copies this browser's settings, including secrets, into a file for this person to keep or move. Import reads that file into this browser; whoever holds an unlocked export can read its settings.

## settings-clear-everything

This removes every Agent M setting held in this browser. It changes no repository, and any Pages site under the same owner domain that can read this storage loses access too.

## settings-products-stored

This browser keeps the list of managed product addresses so it can open their repository settings. Any Pages site under the same owner domain can read that browser storage.

## settings-token-stored

This browser keeps this token so Agent M can read and write this repository. Any Pages site under the same owner domain can read it; give it only the minimum repository scope needed.

## settings-product-address

This browser keeps this product address and its optional token so it can test and open the repository. Any Pages site under the same owner domain can read that browser storage.

## settings-managed-products

This browser keeps the managed product list so it can show each repository's settings. Any Pages site under the same owner domain can read that browser storage.

## settings-notifications

Notifications let this browser alert you when something needs your attention. This browser stores whether notifications are switched on; the browser and any Pages site under the same owner domain able to read this storage can read that switch. While a dashboard page is open, it checks every five minutes for open SPEC changes, use cases, architecture files, and release test reports waiting for Accept and release. Checks go only to repository servers with the tokens of this browser and nowhere else. Nothing is checked while no dashboard page is open.

## settings-remote-session

This browser keeps the forwarded port and copied Bridge token for this remote session. Any Pages site under the same owner domain can read them; the Bridge reads its own tunnel settings.

## settings-job-workflow

The product repository keeps Agent M's job workflow. The files name this instance commit and the CI secrets by name only: `AGENT_M_TOKEN` for the person's repository token and one key secret for each CI participant. The secret values are entered on the repository server's secrets page, not in Agent M.

On GitLab every CI/CD variable of a project reaches every job of a pipeline unless it is scoped to an environment, which only the jobs of that environment receive. The agent works in a job of its key's environment, `agent-m-key-<the key's name>`, and the job that writes, which runs no agent, is of `agent-m-write`. So `AGENT_M_TOKEN` is scoped to `agent-m-write` alone, and each key is set twice, once scoped to its `agent-m-key-<name>` and once to `agent-m-write`, which checks the agent's result for it. A variable scoped to `*` reaches the agent's job, and the job workflow is then not safe. Agent M lists the project's variables with your token, which needs the role Maintainer, asking the server for their names and scopes alone: no value reaches this page. Two settings of the project matter as well: *Allow Git push requests to the repository* under CI/CD job token permissions stays off, so that the agent's job cannot push with its job token, and a self-hosted runner of a route does not run untagged jobs, so that the job that writes runs on the server's own runners.

## settings-product-none

A chosen product repository keeps its pseudonymisation setting and collaborator consent records, which every repository reader can read. This browser reads them to show their current state.

## settings-product-unavailable

This browser keeps the selected product address and token. Its token remains available in the repository settings above.

## settings-product-read-only

This product repository keeps its pseudonymisation setting and collaborator consent records, which every repository reader can read. This browser only reads them to show their current state.

## settings-product-records

This product repository keeps pseudonymisation and collaborator consent records for everyone who works on it. This browser reads them and writes them only after a person's Save click.

## settings-instance-lines

The instance repository keeps these settings for everyone who works on the instance. Each line shows a short summary read from its file and *Edit*, which opens the page where the setting is changed. Every reader of the instance repository can read them; a change is a commit under the person's account, made only on a click.

## settings-product-lines

The product's repository keeps these settings for everyone who works on the product. Each line shows a short summary read from its file and *Edit*, which opens the page where the setting is changed. Every reader of the product repository can read them; a change is a commit under the person's account, made only on a click.

## settings-line-participants

The instance's list of participants — the people and agents that can work on its products, with their capabilities, processing place and route — is kept in `docs/participants.md` of the instance repository. Every reader of that repository can read it, and it holds no key or token. The summary counts the participants.

## settings-line-library

The instance's source library — the standards, legal texts and documents that products draw requirements from — is kept as one entry per source under `docs/sources/` of the instance repository. Every reader of that repository can read the entries; the content of a restricted source is kept elsewhere. The summary counts the sources.

## settings-line-models

The instance's process models — the book's catalogue and the models adapted for this instance — are kept under `docs/process-models/` of the instance repository. Every reader of that repository can read them. A product declares which one it uses. The summary counts the models.

## settings-line-instance-resources

The instance's own list of resources — what the instance runs on, such as a cluster or a model endpoint — is kept in `docs/resources.md` of the instance repository, independent of any product's list. Every reader of that repository can read it; a secret appears there by name only. The summary counts the resources.

## settings-line-process

The product's declared process model, with its version, is kept in `docs/process.md` of the product repository. It says how the product is developed: the model, its practices and branches. Every reader of that repository can read it. The summary names the declared model.

## settings-line-roles

The product's role assignments — which participant of the instance fills which role, one file per team — are kept under `docs/role-assignments/` of the product repository. Every reader of that repository can read them. The summary names the teams.

## settings-line-done

The product's Definition of Done — the conditions a pull request meets before it is merged, beyond the job rules — is kept in the section *Definition of Done* of `docs/process.md` of the product repository. Every reader of that repository can read it. The summary shows its first sentence.

## settings-line-schedule

The product's test schedule — which levels of tests run on which occasion, and where — is kept in `docs/tests/schedule.md` of the product repository, and the CI configuration is generated from it. Every reader of that repository can read it. The summary says whether the product has saved a schedule; without one, the book's default applies.

## settings-line-sources

The product's links to the instance's source library — the sources, and the version of each, that apply to the product — are kept in `docs/sources.md` of the product repository. Every reader of that repository can read them. The summary counts the linked sources.

## settings-line-product-resources

The product's resources — what it is built with, tested on or calls at runtime, each pinned to the exact state used — are kept in `docs/resources.md` of the product repository. Every reader of that repository can read the list; a secret appears there by name only. The summary counts the resources.

## trace-versions

A version is the product as it stood at one point: *current* is the text on the default branch, and every other choice is a release tag. A release tag is a name such as `v2026.1.0`, put on a commit when a release was cut; it never moves, so the page shows exactly what the product held then. Choosing a tag shows its requirements, use cases, decisions, modules and tests as they read in that release, and nothing can be edited there. The same address always shows the same version.

## trace-statuses

A use case that realises a requirement has a review status, read from the approval records in the repository: *open* — no one has accepted its current text; *accepted* — a person accepted the text that stands now; *changed since acceptance* — it was accepted once and its text has changed since, so it waits for a new acceptance. A status is derived from the files when the page is drawn; nothing stores it, and it blocks nothing.

## trace-gaps

A gap is a place where the trace from a requirement to what realises it breaks: a requirement no use case realises, one no module or no test names, a use case that realises no requirement, or a name in a use case, module or test that matches no requirement. The lists are derived from the version chosen. Gaps are shown and block nothing: a requirement may rightly wait for its use case, and a version may hold no modules or tests yet, which the page then says.

## trace-none-yet

Here a list reads none yet when the version shown holds no artifact of that kind at all. A list that reads none instead means the version holds such artifacts and none of them names this requirement.
Architecture decisions and module files come when the architecture is derived from the accepted use cases, and tests when the modules are implemented.
Choose a later version to see them once they exist.

## impact-of-a-change

Before a change to an accepted decision or module is accepted, the dashboard works out from the repository at the commit shown what
hangs on it: the modules that follow the decision or use an interface the change alters or removes, those that use a removed one
marked *breaks*; the code files in their folders; the tests that exercise them and the requirements those tests guard; and the
requirements and use cases the file names now and no longer names. Accepting changes no code: the code still reflects the old
architecture until an implementation job changes it. In the book *Vibe Coding*: chapter 10, section 3.

## component-diagram

Computed from the module files at the commit shown: one box per module, inside the box of its subsystem — the first decision it follows;
a module that follows none stands outside every subsystem's box. One arrow from a module to each module it uses, however many of that
module's interfaces it uses. A used module that has no file is drawn as a box of its own, dashed and marked missing.

## group-is-a-heading

A group is only a heading. It gives a title to a stretch of the list, so that a hundred items read as a few chapters, and that
is all it does. A group has no identifier, so no artifact refers to it; nothing realises it and no test guards it. Moving an
item into another group, or a group into another, changes where the item is listed and nothing about the item: its
identifier, its file and its approval stay as they were. Renaming a group changes only its title. A group holds one kind of
artifact, and an item has one place in its hierarchy; an item that is in no group is shown at the top level. Saving an
arrangement commits only the group file of that kind, so the SPEC and every artifact file stay byte-identical.

## implementation-route

The product's process model decides how the software is assembled: what one implementation job is, where its work comes from,
in which order it is done and where it stops at a gate. This is the route each kind of model prescribes:

| Process model | The work comes from | One job implements | Order |
|---|---|---|---|
| plan-driven — V-model, waterfall, reuse-oriented | the implementation plan | one step of the plan: a module, a subsystem's integration, or the system | the plan's order; a phase's jobs start after the gate that closes the phase before |
| Scrum | the team's sprint selection from the backlog | one backlog item | after the items it builds on, within the sprint |
| Kanban | the ready items of the backlog | one backlog item | pulled as its developers choose, after the items it builds on, under the work-in-progress limit |

Every job is the same at its core: a coding participant writes failing tests first, then the code, on a branch, and the pull
request is merged once the product's Definition of Done holds. In the book *Vibe Coding*: chapter 6 for the plan-driven
models, chapter 7 for the agile ones.

## sprint-increment

The increment is the set of done items. An item is done when it is merged and its Definition of Done is met; it is shown with its pull request, the requirements it realises and the tests that guard them. An item that does not meet the Definition of Done is not part of the increment, however close it is: it is shown among the items not done, with its state and the reason. If no item is done, the increment is empty and the review says so.

## sprint-feedback

Feedback is what the people who saw the increment say about it. Enter it as one line per point, each either *new backlog item*, *change to an existing item*, or *noted*. A new backlog item and a change to an existing one are written to the backlog when you close the sprint. If no stakeholder took part, the review says so; a review by an agent names where its feedback came from — issues, mails, job records, test results.

## sprint-unfinished-items

An unfinished item is a selected item that is not done. For each one the Product Owner chooses *back to the backlog* or *into the next sprint*. An item that goes back to the backlog is no longer held by the sprint. The done items stay held until the sprint's increment is merged into the default branch, so that no other team changes or uses their modules meanwhile.

## sprint-retrospective

The retrospective is where the team — people and agents — writes down what went well, what did not, and what it will change in how it works. For each change, the entry names where it goes: the process model ([UC-031](#use-case/id=UC-031)), the product's Definition of Done ([UC-002](#use-case/id=UC-002)), a participant's instructions or configuration ([UC-017](#use-case/id=UC-017)), or *team agreement* only. Agent M offers the numbers of the sprint as material, derived and not typed: jobs failed or retried, time items waited for a person, flaky tests, and cost where it is known. *Close sprint* stays disabled until the retrospective has at least one entry. A change that an agent's retrospective recommends is proposed for a person to accept and not applied by the agent.

## run

A run carries out the product's process model over what you select. You select the steps of the implementation plan — or, in Scrum or Kanban, backlog items — set the limits and press *Start run*: one click. Agent M then generates the CI configuration if the product has none, implements the steps in the plan's order or the items after those they build on, writes the tests, and at the end shows the validation of what was built: what each module realises, its code and tests, and every gap. You are asked only where the model gives a gate to a person, or when a limit is reached. Implementation, tests and CI can also be started each on its own, for one critical step: [UC-024](#use-case/id=UC-024), [UC-026](#use-case/id=UC-026) and [UC-027](#use-case/id=UC-027).

## test-runs

This page shows what the tests said about the commit named above. Each level counts its passed, failed, flaky and not run tests; opening a level shows the individual tests, including what each guards. **Not run** means no result was recorded for that test on this commit. It does not mean passed.

A **failed** test has a recorded result that did not meet its expectation. A **flaky** test has both a passing and a failing result on this same commit, so it is not treated as passed. A flaky test is repaired or removed, not retried until green. A test that depends on a model shows its rate beside the rate from the previous release, so you can see whether it became worse.

Choose *Run on this commit* to start the levels that still need a result. Before it starts, the page shows where the run will happen, any paid services it calls, and the secrets it uses by name.

## test-level-unit

Tests of one function or class in isolation, fast and without external services. Book: ch. 13, Unit Testing.

The level unit checks one function, class or small module in isolation; derived from a module; automated, external services mocked. The book, chapter 13, section "Unit Testing and Automation Structure".

## test-level-component

Tests of the interface between modules. Book: ch. 13, Component Testing.

The level component checks the interface between units that work together; derived from an architecture element and its modules; automated, misuse, misunderstanding and timing cases. The book, chapter 13, section "Component Testing and Interface Risks".

## test-level-system

Tests that walk a use case end to end, with recorded responses in place of paid services. Book: ch. 13, System Testing and ch. 13 on mocking.

The level system checks the integrated product along a use case; derived from a use case; automated, end to end. The book, chapter 13, section "System Testing and Practical Scope Selection".

## test-level-paid

Tests that call a paid service or a model, which cut across the levels; they run nightly, not on every commit. Book: ch. 13 on mocking and the nightly integration test.

## test-level-release

Tests written by a participant other than the implementer, for each requirement. Book: ch. 13, Release Testing.

The level release checks a release candidate against the specification; derived from a requirement; automated or manual, written by someone other than the implementer. The book, chapter 13, section "Release Testing".

## test-level-user

Manual tests whose outcome the people assigned enter. Book: ch. 13, User Testing and Acceptance Decisions.

The level user checks the product in real use: alpha, beta, acceptance; derived from a requirement or acceptance criterion; manual, the outcome entered by a person. The book, chapter 13, section "User Testing and Acceptance Decisions".

## test-occasion-every-commit

Runs on each push to the default branch, so a break shows at once. Book: ch. 12, Test Automation and Continuous Integration.

## test-occasion-pull-request

Runs on each pull request before its merge. Book: ch. 12, Test Automation and Continuous Integration.

## test-occasion-nightly

Runs once a night, for what is too slow or too costly for every commit, such as the integration test against real services. Book: ch. 13 on mocking and the nightly integration test.

## test-occasion-release-candidate

Runs on a release candidate, and must run every test at every level; it cannot be cleared. Book: ch. 13, Release Testing.

## test-occasion-on-demand

Runs when a person starts it, naming the rows to run. Book: ch. 12, Test Automation and Continuous Integration.

## schedule-field-nightly

The time of the nightly run, HH:MM in UTC. Book: ch. 13 on mocking and the nightly integration test.

## schedule-field-command

The command that runs the test files a job is given; leave it empty where the tests run with node's own test runner. Book: ch. 12, Automated Build Systems.

## schedule-field-setup

A command run in every test job before its tests, such as installing what they need; leave it empty where nothing is installed. Book: ch. 12, Automated Build Systems.

## schedule-field-cache

The paths on the runner that setup fills and the CI service keeps between runs, one path per line; leave it empty where nothing is kept. Book: ch. 12, Test Automation and Continuous Integration.

## schedule-field-minutes

The time limit of every job on every commit and on a pull request, in whole minutes; leave it empty where none is set. Book: ch. 12, Test Automation and Continuous Integration.

## schedule-secrets

The tests that call a paid service or a model read their key from the CI's secrets. Open the server's secrets page for this product, add a secret there under the name shown, and paste its value into the server's form, never into Agent M. Book: ch. 13 on mocking and the nightly integration test.

## schedule-self-hosted-runner

A row on a self-hosted runner waits until a machine of yours is registered to this repository with the label shown. Open the server's runner page: it shows the command to run on that machine, with a short-lived token of its own, which Agent M never sees. Until a runner with the label is online, the runs of the row stay queued. Book: ch. 12, Test Automation and Continuous Integration.

## run-jobs-at-once

How many jobs the run may have running at the same time. It is preset to the work-in-progress limit of the product's process model, or to 3 where the model sets none. A job that waits for another job or for a gate does not start before it is done, however high the number is; steps that do not depend on each other run side by side up to it.

## run-cost-limit

The most the run may cost. It is counted only from costs the runtimes report: a job whose runtime reports none adds nothing to the count and is shown with its cost unknown. When the limit is reached the run starts no further job, lets the running ones finish, and says that the cost stopped it. You may raise the limit and press *Continue*, which starts the remaining jobs under the same run.

## run-correction-rounds

How many times a draft may go back to its participant to be corrected before it is shown to you with what is left. It is preset to 5 per draft, and it applies to every job of the run that drafts. When the limit is reached the run starts no further job, lets the running ones finish, and says that the rounds stopped it.

## main-page

This page shows where each product of this instance stands on its way through the process: one bar of six stages, each filled by the share of its work that is accepted or done, and each stage a link to the page where that stage's work is reviewed and done. While this browser manages no product, it shows Agent M itself, on its way to its first release.

Everything is read from the repositories when the page opens; nothing is stored. Your products and your token live only in this browser. The menu above leads through the process in its order.

## resources

A *resource* is something the product is built with or runs on: another repository, data, a model, a computer to run jobs on, an
endpoint the product calls. Three things look alike and are kept apart. A **resource** is *used* by the product or one of its jobs,
and is fixed to the exact state the product uses, such as a commit; it is written down here, in `docs/resources.md` of the
repository. Examples: a private repository of DLLs (`speech-dlls`), `meta-llama/Llama-3.1-8B` on Hugging Face at a fixed
revision, the SLURM cluster *Alex* at NHR@FAU, a vLLM endpoint that the product queries. A **requirement source** is a rule the
product must *meet*, such as the EU AI Act or IEC 62304 class B; it is written down in the sources of the product, and a rule
you meet is registered as in [UC-015](#use-case/id=UC-015). A **participant** *develops* the product, such as a colleague,
Claude Code on the author's machine or a CI agent; it is in the instance's list of participants, see [UC-017](#use-case/id=UC-017).
The same endpoint can be two of these: a resource the product queries and, behind a Bridge, a participant that works on the
product. It is then two entries that share nothing. The instance has resources of its own, in its own list; the two lists never
inherit from each other. In the book *Vibe Coding*: chapter 6, section 5, on reuse, which "buys dependencies".

## resource-kind

Each resource has one kind, and the kind says what is written down about it. A *repository*, such as the private repository of
binaries `https://gitlab.rrze.fau.de/lme/speech-dlls`, is pinned to a commit. *Data*, such as a Hugging Face dataset or a folder on
a group share, and a *model*, such as a Hugging Face model or a checkpoint file, are pinned to a revision or to the SHA-256 of
every file. A *compute* resource, such as a SLURM cluster or a GPU machine, has no pin: the software on it is pinned in the job's
own files. An *endpoint*, such as a local vLLM or Ollama server, and an *agent*, an agent service the product delegates to at
runtime, are pinned to the identifier of the model they serve. Give each resource a name that is unique in the list and its address; the other columns
follow from the kind, and the form shows what is still missing beside it.

## resource-licence

The licence says under what terms the resource may be used and passed on, and the maintainer says who looks after it: an account,
an organisation, a collaborator who agreed to be named, or *unknown*. A licence that does not allow redistribution means that only
the address and the pin are written to the repository; the content stays where it is. An unknown licence counts as restricted until
someone records it. A rule that a resource's licence puts on the product, such as no commercial use, does not become a requirement
by standing here; register the licence as a source for that ([UC-004](#use-case/id=UC-004)) and link it to the product
([UC-015](#use-case/id=UC-015)). A maintainer who is a single person is a risk that the form warns of, a *bus factor* of one: the
PEAKS speech-evaluation system, book chapter 6 section 5, reused a stack that only its lead developer could maintain end to end,
and when he left it could be kept running but not extended for years.
A resource that needs a key names only where the key is held, `ci:<NAME>` for a CI secret or `browser` for a key kept in this
browser; the key itself is never written to the repository, and a leaked key is like a published credit-card number.

## resource-move

A pin says the exact state the product uses, and it changes only when you change it. When a resource has a newer state upstream, the
page shows it beside the pin, with the jobs and tests that name the resource, which are listed and not changed. **Move** takes the
newer state as the pin: one click, and one commit of the list as your own.

## resource-check

A check makes one harmless request to the resource. A repository is checked by reading its current head. A compute resource reached
by a self-hosted runner is checked by a job on that runner: the run panel above shows which participant does it and what it is sent
before you press **Run**, and the job's record in the repository shows its result. A runner serves a private repository only. A
resource reached through a Bridge is checked by a request through the Bridge its route names: the page asks that Bridge, which lists a cluster's partitions, lists the models an endpoint serves or gets an answer from an agent, and the page shows the answer. That check writes nothing.

## resource-copy

The instance has resources of its own that a product may use as well, such as a cluster. **Copy from the instance** puts one of them
into this product's list, where you edit and save it like any other. The copy is not linked to the original: a later change on
either side leaves the other unchanged.

## job-state-waiting-at-a-gate

The job stopped at a gate of the product's workflow and goes no further until the gate's decider has decided. The decider is a person or an agent holding the deciding role, or a CI check, as the gate names it. Open the job to see what the gate checks and the artifacts to examine; a gate that is yours is passed or rejected there, with one click. A job can also wait at a question for the author. These jobs are listed first.

## job-state-running

The participant is working on the job right now. The runtime that holds the job says so: the browser tab, the GitHub Actions or GitLab CI run, or the Bridge. Open the job to follow its log while it runs, and press **Cancel** to stop it.

## job-state-cancelling

A person asked to stop the job and its runtime has not confirmed yet. It is shown within running until it does; then its end, cancelled, is written. Until then it may still push to its branch.

## job-state-queued

The job was handed to a route and no runtime has picked it up yet. A CI job waits for the workflow run to start, a Bridge job for the Bridge to take it. You can cancel a queued job; nothing has been written for it.

## job-state-done

The job finished. Its result is linked from the job: the commits and the pull request it made, or the draft it returned. A done job stays in the list as the record of what was done.

## job-state-failed

The job ended with an error. The reason and the log are linked from the job. **Retry** starts a new job with a new identifier and the same inputs, with the same participant or another holder of the role; the earlier job stays in the list.

## job-state-cancelled

A person stopped the job. Whatever it pushed before it was stopped stays on its branch, and it writes nothing afterwards. **Retry** starts a new job with the same inputs.

## job-state-ended-without-record

The job was started, but its record has no end and no runtime knows it any more: the tab was closed, or the Bridge was restarted while it ran. Nothing says how it ended. Look at its branch for what it wrote, and retry it if the work is still needed.

## job-runtime-tab

A job in the **browser tab** is a conversation with a model endpoint that this page runs for you. Its record is kept in the product's repository, like that of any job. Its live state and log exist only in the tab that runs it, so a job whose tab is closed is shown as ended without record. It is listed here as this tab's while it runs. A long job is better started on CI or on a Bridge, which go on when this page is closed.

## job-runtime-ci

A job on **CI** runs on the server's own machines: a GitHub Actions workflow run or a GitLab CI pipeline of the product's job workflow, on a hosted runner or on a self-hosted one with a label. Its state is read from the run, and its log is the run's page on the server. The key it needs is a CI secret of the repository.

## job-runtime-bridge

A job on a **Bridge** runs on a computer of yours, where the Bridge is installed, with a coding agent that is logged in there. This browser keeps each Bridge under its name and asks it for its jobs with its token. If the Bridge does not answer, the job is shown with the reason, and its state stays as the record says.

## implementation-plan

The implementation plan decides how the accepted architecture is assembled into software, before any of it is implemented: the modules of each subsystem in the order of the interfaces they use, then the integration of each subsystem, then the system, each step with the tests of its level. It is the V-model's idea that "whenever you define something on the way down, you should already know how you will check it on the way back up": what the architecture decomposed, the plan integrates again.

| A step for | It implements or integrates | Its tests |
|---|---|---|
| a module | the module, as its file describes it | unit tests |
| a subsystem | the subsystem's modules, as its decision describes their interplay | component tests |
| the system | the subsystems, as the decision that states the system describes it | system tests, and the release tests of the use cases, written by a participant other than the implementer |

In the reuse-oriented model, a module whose decision adopts a library or a service is configured or adapted in its step rather than developed. In Scrum and Kanban the backlog takes this place. In the book *Vibe Coding*: chapter 6.

## plan-step-states

Each step of the plan shows its state: *waiting* for a step it depends on, *ready*, *in progress* or *done*. No state is stored in the plan: each is derived from the job records and the pull requests.

## plan-draft

*Draft the plan* opens a run panel. The run panel names the drafting participant, where it processes data and what is sent: the architecture, the process model and the existing plan. The click on Run is the decision.

The participant drafts the plan from the bottom up: one step for each module, a module after every module whose interface it uses; then one step for each subsystem's integration; then one step for the system. Each step names the phase of the model it belongs to, and the model's gates stand between the phases. Agent M checks the complete draft: a module, a subsystem or the system without a step, a module ordered before one whose interface it uses, or a step without the tests of its level goes back to the participant as a finding.

## plan-save

*Save plan* is one click: it commits one Markdown file for each step under `docs/plan/`, each an item `ITM-<nnn>-<slug>.md` naming what it implements or integrates and the tests of its level, and the order of the steps in `docs/plan/order.md`. From then on implementation jobs start only for steps of the plan. Nothing is written before the click.

## get-your-own-owner

Your own Agent M lives in a *fork*: a copy of Agent M that GitHub keeps under a GitHub account or an organisation. Name the account or organisation you want it under. An account or organisation used for nothing else is recommended: every GitHub Pages site under the same `<owner>.github.io` address can read what this browser stores for your dashboard, so a site of yours that has nothing to do with Agent M should not share that owner with it.

## get-your-own-fork

A *fork* is your own copy of Agent M on GitHub. Press the button, choose the account or organisation to fork into, and press *Create fork*. The fork keeps the name `agent-m`; nothing you do in it changes the original.

## get-your-own-pages

*GitHub Pages* publishes the files of a repository as a website. Your dashboard is that website, so it has to be switched on once. On GitHub's page under *Build and deployment* choose *Deploy from a branch*, then the branch `main` and the folder `/ (root)`, and press *Save*. GitHub lets no one but the owner of the repository switch this on, which is why the link opens a page you must be signed in to.

## get-your-own-actions

*Workflows* are the small programs GitHub runs for a repository. GitHub disables workflows on every fork until its owner enables them. Agent M needs them only to fetch EU legal texts for the source library and to write an accepted change of the instance's own SPEC without a token, when you accept it on GitHub's page. Everything else works without them, so you can press *Later*; the dashboard shows this step again when a feature first needs them. On GitHub's page press *I understand my workflows, go ahead and enable them*.

## get-your-own-open

Your dashboard is the website of your fork: `https://<owner>.github.io/agent-m/`. GitHub needs about a minute after the Pages step before the address answers; until then it shows a page that says it cannot be found, and nothing is wrong. When it opens, the dashboard asks you to finish setting up.

## get-your-own-licence

Agent M is published under the MIT licence. That licence is what allows the fork: you may copy, change and use Agent M as you like. It covers Agent M only; the licence of every product stays yours.
