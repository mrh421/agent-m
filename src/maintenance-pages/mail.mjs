// The route `mail` — mail read into issues (UC-038 steps 1 to 3, 7 to 9, 10, and 2a, 4b, 6a, 7a, 7b, 8a), as docs/architecture/MOD-maintenance-pages.md states it and ITM-963 builds it: *Read mailbox*; the mails no issue lists and
// nobody marked *not an issue*, with sender, subject and date in this browser only; per mail, the mail in full beside the proposal (empty here: UC-038 4b), its text editable, every hit of the mail's people marked; *Create issue* — only
// without a hit —, *Add to #n*, *Not an issue*. The participant, the run panel and *Propose* (UC-038 steps 4 to 6, 4a, 4c, 5a, 5b, 6b, 6c) are ITM-964's, below.
//
// Module: MOD-maintenance-pages
//
// Readings the texts leave open, which this file takes (the pull request names them):
//   - Reading the mailbox and each decision are made on a click the browser marks as a person's (`isTrusted`): reading may write a note that lists a reply on the issue of its thread, and a decision writes.
//   - After Create issue or Add to #n the mail stays in the list with what came of the click (7b: Create issue once per concern); after Not an issue it leaves it. The next reading leaves out every mail an issue lists or the store marks.
//   - Create issue is disabled while a hit of the mail's people stands in the title or the text, and while either is empty. A created issue of the kind change is followed by a link to its route `issue/<n>` (step 10: Propose SPEC change).
//   - The products are those this browser keeps (`products`), each connected with its own token (else, for GitHub, the instance's). The mailbox is the stored connection; on the Bridge route the Bridge it names, by its stored name.
//   - The folded explanations are built here, not by the frame's `explain`: explanations.md holds no topic of this page and it is the frame's file (as the schedule page of MOD-test-pages does).
//   - The subject a route that shows mail gives the prompt bar (mailSubject, ITM-510; MOD-maintenance-pages.md, Interfaces): its page holds the `MAIL-` identifiers of the listed mails, and, per mail, its sender, subject, date, text and attachments only for a
//     participant whose `place` is among the places the mailbox's connection allows and that does not declare "write to the repository"; it refuses `propose-edit` and `hand-over`; its `withhold` gives a reason for a message that holds a name, address, phone
//     number or account of a listed mail's people (personHits) or a passage of a listed mail's own text — a run of at least twenty characters of it, whatever the case and the spacing —, and null otherwise.

import { bridgeAt, settingsOf } from "../bridge-client/index.mjs";
import { readSetting } from "../browser-store/index.mjs";
import { readDocument, readRegister } from "../documents/index.mjs";
import { newJobId } from "../job-ledger/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { prepareJob } from "../job-runner/index.mjs";
import { mailbox, signIn } from "../mail-routes/index.mjs";
import { decideMail, readNewMail } from "../mail-handling/index.mjs";
import { eligible, participantSchema, participantsOf } from "../participant-list/index.mjs";
import { checkersFor, personHits, pseudonymisationOf, settingsSchemas } from "../personal-data/index.mjs";
import { connect, parseAddress } from "../repository-hosts/index.mjs";
import { queueJob, runOnTab } from "../runtimes/index.mjs";
import { runPanel } from "../site-frame/index.mjs";

const REGISTER = "docs/participants.md";
const SETTINGS = "docs/settings.md";
const JOB_FILE = /^docs\/jobs\/(JOB-[^/]+)\.md$/;

const STEP_TEXT = {
  read: "Read mailbox reads the folders named in the mailbox connection, read-only: nothing is marked as read, moved or flagged. Each mail gets the identifier MAIL- plus sixteen hex digits of the hash of its Message-ID. A mail whose thread an issue lists is attached to that issue at once, with a note, and shown under it. Book: ch. 14, Evolution Processes and Change Identification.",
  list: "These mails are listed with sender, subject and date, in this browser only. A mail an issue already lists, or that you marked not an issue in this browser, is left out. Nothing here is stored anywhere but in the mailbox.",
  propose: "Propose asks the participant you choose, once for all the listed mails, for a proposal per mail: the product, the kind, a neutral title and text, and the open issues it may duplicate. Only participants at a place this mailbox allows are offered; a place outside the EU is named as not compliant with the GDPR and the EU AI Act. The run panel states where the participant processes data and exactly what it receives, and the three checking participants where each processes data and that each receives only the rewritten texts. Nothing is sent until you press Run. You can still decide every mail by hand without Propose.",
  review: "Each mail is shown in full beside its proposal, which is empty until you press Propose: then write the neutral title and text yourself. The text is searched, without a model, for the mail's people; a hit is marked and Create issue stays disabled until you have edited it out. An attachment goes to the participant only if you tick it; it goes into the issue only if you add it, rewritten without any person and checked by three other participants, or unchanged when the product switched pseudonymisation off.",
  decide: "One click decides a mail. Create issue writes one issue to the product's tracker, labelled defect or change, listing the mail's identifier and naming no reporter. Add to #n lists the mail on an existing issue. Not an issue marks the mail in this browser by its identifier. Nothing else of the mail is written to a repository.",
};

export function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}
export const fold = (text) => el("details", "explain", el("summary", null, "What is this?"), el("p", null, text));
export const link = (href, className, text) => { const anchor = el("a", className, text); anchor.setAttribute("href", href); return anchor; };
// The address of the route `issue` for an issue of a product, as the frame's routeOf reads it: `#issue/number=<n>/product=<address>`, every part percent-encoded (MOD-site-frame, Parts).
export const issueRoute = (number, product) => `#issue/number=${encodeURIComponent(number)}${product ? `/product=${encodeURIComponent(product)}` : ""}`;
// A listener that answers only a click the browser marks as a person's (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
export function button(className, text, listener) {
  const node = el("button", className, text);
  node.setAttribute("type", "button");
  node.addEventListener("click", (event) => { if (event?.isTrusted === true && !node.disabled) listener(event); });
  return node;
}

// The mails now listed with their people: what the subject of this route gives the prompt bar (in memory only, while shown).
let listed = [];

// The hosts of the products this browser keeps, by their address as the store lists it: each with its own token, else, for GitHub, the instance's.
export function productsOf(store) {
  const hosts = new Map();
  for (const url of readSetting(store, "products") ?? []) {
    try {
      const address = parseAddress(url);
      const key = address.server === "gitlab" ? `gitlab-token:${new URL(address.origin).host}/${address.path}` : `github-token:${address.path}`;
      const stored = readSetting(store, key) ?? (address.server === "github" ? readSetting(store, "github-token") : null);
      hosts.set(url, { address: url, name: address.path, host: connect(address, stored?.value ? { token: stored.value } : {}) });
    } catch { /* an address that cannot be read is no product */ }
  }
  return hosts;
}

export function mailboxOf(store) {
  const connection = readSetting(store, "mailbox");
  if (!connection) return null;
  if (connection.route === "graph") return { connection, box: mailbox(connection, null) };
  const entry = readSetting(store, `bridge:${connection.imap?.bridge}`);
  const bridge = entry ? bridgeAt(settingsOf({ name: connection.imap.bridge, ...entry }, readSetting(store, "jump-host"))) : null;
  return { connection, box: mailbox(connection, bridge) };
}

// The endpoints and Bridges the participants are reached by, as the tab's route drives them (the page replies has the same need).
export function connectionsOf(participants, store) {
  const endpoints = {}, bridges = {};
  const connectBridge = (name) => {
    if (!name || bridges[name]) return;
    const stored = readSetting(store, `bridge:${name}`);
    if (stored) bridges[name] = bridgeAt(settingsOf({ name, ...stored }, readSetting(store, "jump-host")));
  };
  for (const participant of [participants].flat()) {
    const name = /^endpoint\s+(\S+)/.exec(participant.route ?? "")?.[1];
    const stored = name === undefined ? null : readSetting(store, `endpoint:${name}`);
    if (stored) {
      endpoints[name] = { config: { name, kind: stored.kind, baseUrl: stored.url, model: stored.model, key: stored.key ?? null }, bridge: stored.bridge ?? null };
      connectBridge(stored.bridge);
    }
    connectBridge(/^bridge\s+(\S+)\s+agent\s+\S+/.exec(participant.route ?? "")?.[1]);
  }
  return { endpoints, bridges };
}

export const failed = (failure) => `${failure?.name ?? "Error"}${failure?.reason ? ` (${failure.reason})` : ""}: ${failure?.message ?? failure}`;

// What the page reads once per reading to offer participants: the instance's register, and the places the mailbox allows.
async function sessionOf(context, have, products) {
  const instanceHost = context.instance?.host;
  if (!instanceHost || products.size === 0) return null;
  const info = await instanceHost.repositoryInfo();
  const instanceSnapshot = await instanceHost.readSnapshot(info.defaultBranch);
  const register = await instanceSnapshot.read(REGISTER);
  const participants = register == null ? [] : participantsOf(readRegister(participantSchema(), REGISTER, register).document);
  return { instanceHost, instanceSnapshot, participants, places: have.connection.places ?? [], allowed: (have.connection.places ?? []).map((each) => each.place), products, store: context.store, box: have.box };
}

// A job of a kind of this page, prepared: the job's record is committed to the repository of the first managed product (a mail concerns no product before it is proposed), as the page replies commits its jobs to the issue's product.
async function jobOf(session, kindName, params, choice, person) {
  const first = [...session.products.values()][0];
  const head = await first.host.readSnapshot((await first.host.repositoryInfo()).defaultBranch);
  const now = new Date();
  const id = newJobId(now, new Set(head.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean)));
  const agentM = { version: session.instanceSnapshot.commit ?? "unknown", commit: session.instanceSnapshot.commit ?? "unknown" };
  const jobContext = { kind: await kindOf(kindName), params, product: { address: first.address, snapshot: head, host: first.host }, instance: { snapshot: session.instanceSnapshot, host: session.instanceHost, checkout: null },
    connect: async () => first.host, participants: session.participants, places: { sources: {}, mailbox: session.allowed }, gates: [], person, now, agentM, jobId: id };
  const prepared = await prepareJob(kindName, jobContext, choice);
  return { prepared, jobContext, head, id, now, agentM, host: first.host, kind: kindName, person, choice };
}

// The job run in this tab on the person's click: its start record committed, the participants reached by their routes.
async function runJobOf(session, job) {
  const { prepared, choice } = job;
  const record = { id: job.id, kind: job.kind, worksOn: [...session.products.values()].map((each) => each.address), participant: choice.drafter.name, model: choice.drafter.model, route: "tab", run: null, retries: null, startedBy: job.person,
    start: job.now, agentM: job.agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit, destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params: {} };
  const { path } = await queueJob(job.host, record, { kind: "tab" }, job.head.commit);
  return runOnTab(prepared, job.jobContext, connectionsOf([choice.drafter, ...choice.reviewers], session.store), { host: job.host, record: { ...record, path } });
}

// Whether a product rewrites report data: docs/settings.md of its default branch, which keeps it on where it is missing.
async function pseudonymisationFor(product) {
  const snapshot = await product.host.readSnapshot((await product.host.repositoryInfo()).defaultBranch);
  const text = await snapshot.read(SETTINGS);
  return text == null ? "on" : pseudonymisationOf(readDocument((await settingsSchemas()).settings, SETTINGS, text));
}

const who = (address) => (address.name ? `${address.name} <${address.address}>` : address.address);

// The review of one mail: the mail in full beside an empty proposal, its hits, and the three decisions.
function reviewOf({ mail, people }, { products, store, context, onMarked, session, choice, hooks }) {
  const product = el("select", "mail-product", ...[...products.values()].map((each) => { const option = el("option", null, each.name); option.setAttribute("value", each.address); return option; }));
  const kind = el("select", "mail-kind", ...["defect", "change"].map((name) => { const option = el("option", null, name); option.setAttribute("value", name); return option; }));
  kind.value = "defect";
  const title = el("input", "mail-title");
  const body = el("textarea", "mail-body");
  const hitsList = el("ul", "mail-hits");
  const number = el("input", "mail-issue-number");
  const result = el("p", "mail-result");
  // A proposal without a managed product leaves the choice to the person (UC-038 5b): until they pick, no product is chosen.
  let needsProduct = false;
  const chosen = () => (needsProduct ? null : products.get(product.value) ?? [...products.values()][0] ?? null);
  const issueNumber = () => (/^\d+$/.test(String(number.value ?? "").trim()) ? Number(number.value) : null);

  const create = button("create-issue", "Create issue", () => decide({ kind: "create", product: chosen()?.address, title: title.value, text: body.value, label: kind.value }));
  const add = button("add-to-issue", "Add to #n", () => decide({ kind: "add", product: chosen()?.address, issue: issueNumber() }));
  const none = button("not-an-issue", "Not an issue", () => decide({ kind: "not-an-issue" }));
  create.disabled = true;
  add.disabled = true;

  function refresh() {
    const hits = [...personHits(String(title.value ?? ""), people), ...personHits(String(body.value ?? ""), people)];
    hitsList.replaceChildren(...hits.map((hit) => el("li", "mail-hit", `${hit.kind}: ${hit.value}`)));
    create.disabled = hits.length > 0 || !String(title.value ?? "").trim() || !String(body.value ?? "").trim() || chosen() === null;
    const n = issueNumber();
    add.textContent = n === null ? "Add to #n" : `Add to #${n}`;
    add.disabled = n === null || chosen() === null;
  }
  product.addEventListener("change", () => { needsProduct = false; });
  for (const [node, type] of [[title, "input"], [body, "input"], [number, "input"], [product, "change"], [kind, "change"]]) node.addEventListener(type, refresh);

  // The proposal of the participant for this mail: the person's fields are filled from it and stay the person's to change (UC-038 7a).
  const proposalBox = el("div", "mail-proposal");
  function fill(proposal) {
    proposalBox.replaceChildren();
    if (proposal.kind === "no issue") { proposalBox.append(el("p", "mail-no-issue", "The participant found no issue in this mail (a thank-you, an out-of-office reply, spam). Mark it Not an issue, or write the issue by hand.")); return; }
    const found = [...products.values()].find((each) => each.address === proposal.product || each.name === proposal.product);
    if (found) { product.value = found.address; needsProduct = false; }
    else { needsProduct = true; proposalBox.append(el("p", "mail-no-product", "The participant found no matching product among the managed ones: choose the product, or mark the mail Not an issue.")); }
    if (proposal.kind === "defect" || proposal.kind === "change") kind.value = proposal.kind;
    title.value = proposal.title;
    body.value = proposal.text;
    if ((proposal.duplicates ?? []).length) proposalBox.append(el("ul", "mail-duplicates", ...proposal.duplicates.map((each) => el("li", "mail-duplicate", `#${each.issue}: ${each.reason}`))));
    refresh();
  }

  // Attachments: the text of one goes to the participant only when ticked (5a), and into the issue only when added, rewritten without persons by the chosen participant and checked by three others, or unchanged where the product switched that off (6, 6b, 6c).
  const ticks = new Map();
  const reportStage = el("div", "mail-report-stage");
  async function addReport(attachment, index) {
    reportStage.replaceChildren();
    const problem = (text) => reportStage.append(el("p", "mail-report-problem", text));
    const target = chosen();
    if (!target) { problem("Choose the product first."); return; }
    try {
      if (await pseudonymisationFor(target) === "off") {
        const added = el("div", "mail-report", el("p", "pseudonymisation-off", `Pseudonymisation is off for ${target.name}: this report data goes into the issue unchanged, with whatever persons it names.`), el("pre", "mail-report-data", attachment.text));
        reportStage.append(added);
        body.value = [body.value, attachment.text].filter((text) => String(text ?? "") !== "").join("\n\n");
        refresh();
        return;
      }
      const { participant, checkers, person } = choice;
      if (!participant || !person) { problem("Choose a participant and enter your name under Propose first."); return; }
      if (!checkers || checkers.missing) { reportStage.append(el("p", "mail-missing-checkers", checkers?.missing ?? "Three checking participants are needed.")); return; }
      const job = await jobOf(session, "rewrite-without-persons", { participant, pieces: [{ name: `attachment ${index + 1} of ${mail.id}`, text: attachment.text }], people }, { drafter: participant, reviewers: checkers.checkers }, person);
      const result = el("div", "mail-report-result");
      reportStage.append(runPanel(job.prepared, { onRun: async () => {
        try {
          const outcome = await runJobOf(session, job);
          if (!outcome.draft?.text) { result.replaceChildren(el("p", "mail-report-problem", "The participant returned no rewritten text. Nothing was added.")); return; }
          body.value = [body.value, outcome.draft.text].filter((text) => String(text ?? "") !== "").join("\n\n");
          result.replaceChildren(el("p", "mail-report-added", outcome.remaining?.length ? `The rewritten text was added; ${outcome.remaining.length} finding${outcome.remaining.length === 1 ? " is" : "s are"} left after the last round: read it before you create the issue.` : "The rewritten text was added."));
          refresh();
        } catch (failure) {
          result.replaceChildren(el("p", "mail-report-problem", `The report data could not be rewritten: ${failed(failure)}`));
        }
      } }), result);
    } catch (failure) {
      problem(`The report data could not be added: ${failed(failure)}`);
    }
  }
  const attachments = session ? mail.attachments.filter((each) => each.text !== null && each.text !== undefined).map((attachment) => {
    const tick = el("input", "attachment-tick");
    tick.setAttribute("type", "checkbox");
    tick.setAttribute("data-attachment", attachment.name);
    tick.addEventListener("change", () => hooks.changed());
    ticks.set(attachment.name, tick);
    const add = button("add-report-data", "Add to the issue", () => addReport(attachment, mail.attachments.indexOf(attachment)));
    add.setAttribute("data-attachment", attachment.name);
    return el("li", "mail-attachment", el("label", null, tick, ` send the text of ${attachment.name} to the participant `), add);
  }) : [];

  async function decide(decision) {
    const found = chosen();
    const which = found?.name ?? "the product";
    try {
      const { issue } = await decideMail({ id: mail.id, people }, decision, found?.host ?? null, store);
      if (decision.kind === "not-an-issue") { onMarked(mail.id); return; }
      result.replaceChildren(decision.kind === "create" ? `Created issue #${issue} in ${which}.` : `Added to #${decision.issue} of ${which}.`);
      if (decision.kind === "create" && decision.label === "change") result.append(" ", link(issueRoute(issue, found?.address), "issue-link", "Propose SPEC change"));
    } catch (failure) {
      if (failure?.name === "PersonFound") { result.textContent = `The text names the mail's people: ${(failure.hits ?? []).map((hit) => hit.value).join(", ")}. Nothing was written.`; return; }
      if (failure?.name === "TokenRefused" || failure?.name === "PermissionMissing") {
        const token = link("#add-product", "token-step", "Store the token for this product");
        token.addEventListener("click", (event) => { event?.preventDefault?.(); context.go("add-product", found ? { address: found.address } : {}); });
        result.replaceChildren(failure.name === "PermissionMissing" ? `The token for ${which} lacks the permission to create issues or comments. Nothing was written. ` : `The token for ${which} was refused. Nothing was written. `, token);
        return;
      }
      result.textContent = `${failure?.name ?? "Error"}: ${failure?.message ?? failure}. Nothing was written.`;
    }
  }

  const shown = el("section", "mail-step-review", el("h3", null, "The mail and its proposal"),
    el("p", "mail-head", el("span", "mail-sender", who(mail.from)), " · ", el("span", "mail-subject", mail.subject), " · ", el("span", "mail-date", mail.date)),
    el("pre", "mail-text", mail.text),
    el("label", null, "Product ", product), " ", el("label", null, "Kind ", kind),
    el("p", null, el("label", null, "Title ", title)), el("p", null, el("label", null, "Text ", body)), hitsList, proposalBox,
    ...(attachments.length ? [el("ul", "mail-attachments", ...attachments), reportStage] : []), fold(STEP_TEXT.review));
  const decisions = el("section", "mail-step-decide", create, " ", el("label", null, "Issue number ", number), " ", add, " ", none, result, fold(STEP_TEXT.decide));
  const item = el("li", "mail", shown, decisions);
  item.setAttribute("data-mail", mail.id);
  return { item, fill, ticked: () => [...ticks].filter(([, tick]) => tick.checked === true).map(([name]) => name) };
}

// Propose: the participants the mailbox allows, the three checkers, the run panel and its Run — *Propose*, one click for all listed mails (UC-038 4, 4a, 4c, 6c).
async function proposeSection(session, entries, reviews, choice, hooks) {
  const section = el("section", "mail-step-propose", el("h3", null, "Propose"), fold(STEP_TEXT.propose));
  const definition = await kindOf("propose-issues");
  const admitted = eligible(session.participants, { capabilities: definition.needs, places: [{ from: "the mailbox", allowed: session.allowed }] }).eligible;
  if (admitted.length === 0) {
    section.append(el("p", "mail-no-participant", `No participant that can draft text works at a place this mailbox allows (${session.allowed.join(", ") || "none"}). Nothing is sent; you can still decide each mail by hand. `, link("#mailbox", "places-link", "The mailbox's processing places")));
    return section;
  }
  const outsideEu = (place) => (session.places ?? []).find((each) => each.place === place)?.outsideEu === true;
  const radios = admitted.map((participant) => {
    const radio = el("input", "participant");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", "participant");
    radio.value = participant.name;
    const item = el("li", "mail-participant", el("label", null, radio, ` ${participant.name} `), el("span", "place", participant.place ?? "no processing place declared"),
      ...(outsideEu(participant.place) ? [" ", el("span", "not-compliant", "outside the EU: not compliant with the GDPR and the EU AI Act")] : []));
    item.setAttribute("data-participant", participant.name);
    return { radio, item, participant };
  });
  const person = el("input", "person");
  person.setAttribute("placeholder", "Your name");
  const checkersBox = el("div", "mail-checkers-box");
  const stage = el("div", "mail-stage");
  let turn = 0;

  async function refresh() {
    const mine = turn += 1;
    stage.replaceChildren();
    checkersBox.replaceChildren();
    const chosen = radios.find((each) => each.radio.checked === true)?.participant;
    const name = String(person.value ?? "").trim();
    Object.assign(choice, { participant: chosen ?? null, person: name, checkers: null });
    if (!chosen || !name) { stage.append(el("p", "muted", "Choose a participant and enter your name to see the run panel.")); return; }
    const found = checkersFor(session.participants, chosen, session.allowed);
    choice.checkers = found;
    if (found.missing) {
      checkersBox.append(el("p", "mail-missing-checkers", `${found.missing} Nothing is sent. `, link("#participants", "participants-link", "The participants"), " ", link("#mailbox", "places-link", "The mailbox's processing places")));
      return;
    }
    checkersBox.append(el("ul", "mail-checkers", ...found.checkers.map((checker) => el("li", "mail-checker", `${checker.name} · `, el("span", "place", checker.place ?? "no processing place declared"), " · receives only the rewritten texts"))));
    try {
      const params = { mails: entries.map(({ mail, people }) => ({ mail, people, ticked: reviews.get(mail.id).ticked() })), products: [...session.products.values()].map(({ address, host }) => ({ address, host })) };
      const job = await jobOf(session, "propose-issues", params, { drafter: chosen, reviewers: [] }, name);
      if (mine !== turn) return;
      const result = el("div", "mail-propose-result");
      stage.append(runPanel(job.prepared, { onRun: async () => {
        try {
          const outcome = await runJobOf(session, job);
          const given = outcome.draft?.proposals ?? [];
          let shown = 0;
          for (const proposal of given) if (reviews.has(proposal.mail)) { reviews.get(proposal.mail).fill(proposal); shown += 1; }
          result.replaceChildren(el("p", "mail-proposed", `${shown} proposal${shown === 1 ? "" : "s"} shown beside the mails. Nothing was created: decide each mail with one click.`));
        } catch (failure) {
          result.replaceChildren(el("p", "mail-propose-problem", `Nothing was proposed: ${failed(failure)}`));
        }
      } }), result);
    } catch (failure) {
      if (mine === turn) stage.append(el("p", "mail-propose-problem", failed(failure)));
    }
  }
  hooks.changed = refresh;
  for (const input of [...radios.map((each) => each.radio), person]) input.addEventListener("change", refresh);
  section.append(el("ul", "mail-participants", ...radios.map((each) => each.item)), el("label", null, "Your name ", person), checkersBox, stage);
  return section;
}

async function render(target, context) {
  listed = []; // a page drawn anew lists no mail until the mailbox is read
  const out = el("div", "mail-out");
  const read = button("read-mailbox", "Read mailbox", async () => {
    out.replaceChildren(el("p", "muted", "Reading the mailbox…"));
    const store = context.store;
    const products = productsOf(store);
    const have = mailboxOf(store);
    if (!have) { out.replaceChildren(el("p", "mailbox-problem", "No mailbox is connected in this browser. Connect one on the Settings page first.")); return; }
    let found;
    try {
      found = await readNewMail(have.box, [...products.values()].map((each) => ({ address: each.address, host: each.host })), readSetting(store, "not-an-issue") ?? []);
    } catch (failure) {
      const problem = el("p", "mailbox-problem", `The mailbox could not be read, so nothing was read: ${failure?.name ?? "Error"}${failure?.reason ? ` (${failure.reason})` : ""}: ${failure?.message ?? failure}`);
      if (failure?.name === "SignInExpired" && have.connection.graph) {
        const again = button("sign-in-again", "Sign in again", async () => {
          try { await signIn(have.connection.graph.clientId, have.connection.address); problem.textContent = "Signed in. Read the mailbox again."; } catch (error) { problem.textContent = `Signing in failed: ${error?.name ?? "Error"}: ${error?.message ?? error}`; }
        });
        out.replaceChildren(problem, again);
      } else out.replaceChildren(problem);
      listed = [];
      return;
    }
    const list = el("ul", "mail-list");
    const shown = new Map();
    const reviews = new Map();
    const onMarked = (id) => { shown.get(id)?.remove(); reviews.delete(id); listed = listed.filter((each) => each.mail.id !== id); };
    const choice = { participant: null, checkers: null, person: "" };
    const hooks = { changed: () => {} };
    let session = null, sessionProblem = null;
    try { session = await sessionOf(context, have, products); } catch (failure) { sessionProblem = failure; }
    for (const entry of found.proposable) {
      const review = reviewOf(entry, { products, store, context, onMarked, session, choice, hooks });
      shown.set(entry.mail.id, review.item);
      reviews.set(entry.mail.id, review);
      list.append(review.item);
    }
    let propose = null;
    if (sessionProblem) propose = el("p", "mail-propose-problem", `No participant can be offered, since the instance's participants could not be read: ${failed(sessionProblem)}`);
    else if (session && found.proposable.length) {
      try { propose = await proposeSection(session, found.proposable, reviews, choice, hooks); } catch (failure) { propose = el("p", "mail-propose-problem", `No participant can be offered: ${failed(failure)}`); }
    }
    listed = [...found.proposable];
    const attached = el("ul", "mail-attached", ...found.attached.map((each) => {
      const issue = link(issueRoute(each.issue, each.product), "issue-link", `#${each.issue}`);
      return el("li", "mail-attached-item", `Mail ${each.id} belongs to the thread of issue `, issue);
    }));
    out.replaceChildren(el("p", "mail-decided", `${found.decided} mail${found.decided === 1 ? " was" : "s were"} left out as decided.`), attached, ...(propose ? [propose] : []),
      el("section", "mail-step-list", el("h3", null, "Mails to decide"), list, fold(STEP_TEXT.list)));
  });
  target.replaceChildren(el("h2", null, "Mail"), el("section", "mail-step-read", el("p", null, read), fold(STEP_TEXT.read)), out);
}

const PASSAGE = 20;
const squeeze = (text) => String(text).toLowerCase().replace(/\s+/g, " ");
// The runs of PASSAGE characters of a text, once each.
const runsOf = (text) => { const runs = new Set(); for (let at = 0; at + PASSAGE <= text.length; at += 1) runs.add(text.slice(at, at + PASSAGE)); return runs; };

/**
 * mailSubject({ key, title, entries, store }) -> Subject — what a route that shows mail gives the prompt bar (UC-049 3b). `entries()` gives the mails now shown, each `{ mail, people }`. The page holds the identifiers of the mails and, only for a
 * participant at a place the mailbox allows that does not write to the repository, their sender, subject, date, text and attachments; `refuses` names propose-edit and hand-over; `withhold(text)` names the mail's people found in the text, or a passage of a
 * mail's own text, and is null where there is none.
 */
export function mailSubject({ key, title, entries, store }) {
  const places = () => (readSetting(store, "mailbox")?.places ?? []).map((each) => each.place);
  const mayRead = (participant) => Boolean(participant?.place) && places().includes(participant.place) && !(participant.capabilities ?? []).includes("write to the repository");
  const pageFor = (participant) => {
    const lines = [title];
    for (const { mail } of entries()) {
      lines.push(mail.id);
      if (!mayRead(participant)) continue;
      lines.push(`From: ${who(mail.from)}`, `Subject: ${mail.subject}`, `Date: ${mail.date}`, mail.text,
        ...(mail.attachments ?? []).map((each) => `Attachment ${each.name} (${each.type}, ${each.size} bytes)${each.text ? `: ${each.text}` : ""}`));
    }
    return lines.join("\n");
  };
  const withhold = (text) => {
    const found = [];
    for (const { people } of entries()) found.push(...personHits(String(text), people).map((hit) => hit.value));
    if (found.length) return `the text names the mail's people: ${[...new Set(found)].join(", ")}`;
    const mine = runsOf(squeeze(text));
    if (entries().some(({ mail }) => [...runsOf(squeeze(mail.text))].some((run) => mine.has(run)))) return "the text quotes a passage of a mail";
    return null;
  };
  return { key, title, entry: null, paramsFor: (participant) => ({ page: pageFor(participant) }), draftRoute: null, withhold, refuses: ["propose-edit", "hand-over"] };
}

const subject = (params, context) => mailSubject({ key: "mail", title: "Mail", entries: () => listed, store: context.store });

export const route = { name: "mail", entry: "maintenance", title: "Mail", render, subject };
