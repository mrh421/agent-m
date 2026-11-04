// flow.mjs — the one review flow every reviewed kind goes through (MOD-review-pages, Parts): the files of a kind with their status
// and a tick, one file with its text and its difference to the last accepted text, accepting what was shown, and Review all: every file not yet accepted on one page, with the acceptance of what it shows.
//
// Module: MOD-review-pages
//
// STATUS IS DERIVED FROM THE RECORDS (it is read from MOD-approvals only); THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; WITHOUT A
// TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN. Nothing is written while a page is drawn.

import { statuses, statusOf, removedFiles, lastAcceptedText, acceptShown, acceptanceBlockers, fallbackAcceptLink, approvalSchema, rejectShown } from "../approvals/index.mjs";
import { blobSha } from "../text-tools/index.mjs";
import { writeDocument, readDocument, artifactSchemas } from "../documents/index.mjs";
import { renderArtifact, showDifference } from "../markdown-render/index.mjs";
import { acceptAndRelease } from "../release-evidence/index.mjs";
import { readSetting } from "../browser-store/index.mjs";
import { parseAddress } from "../repository-hosts/index.mjs";
import { explain, readProblem } from "../site-frame/index.mjs";
import { el, link, reviewHref, reviewLink, arrangeLink, button, badge, handedPlace, parseServer, readPlace, tokenStep } from "./common.mjs";
import { begin as beginSubject, remember as rememberSubject, subjectOf } from "./subjects.mjs";
import { showEdit } from "./edit.mjs";
import { showEntryEdit } from "./entry-edit.mjs";
import { showFileEdit } from "./file-edit.mjs";
import { showDraft, jobNotes, newestJobRecords } from "./jobs.mjs";
import { affectedCheck } from "./affected-modules.mjs";
import { storedOnce, fromStored } from "./stored.mjs";
import { queueService } from "./spec-entries.mjs";
import { rejectSection } from "./reject.mjs";
import { reportSections, splitDueDiligence, dueDiligenceSection, roundsSection, stoppedBecause, changeImpact, graphOnce, affectedModules } from "./sections.mjs";

// What the status approved means (UC-006 4c): the record is committed, the section is not yet written into the SPEC.
const APPROVED_NOTE = "Approval recorded, not yet written into the SPEC — the apply workflow writes it after an approval committed on GitHub's page; " +
  "accepted here with a token, record and SPEC section are one commit.";
// Why an approved entry of the instance's own SPEC is not written yet: the instance's workflows write it, and they are not turned on.
const NOT_WRITTEN = "Approved, not written into the SPEC: the instance's workflows write it, and they are not turned on.";
const LABEL = { open: "open", accepted: "accepted", changed: "changed since acceptance" };
// The id of the page that shows every file not yet accepted: #<route>/id=all.
const REVIEW_ALL = "all";
// The id of the page that drafts files of a kind that has a job to draft them: #<route>/id=draft.
const DRAFT = "draft";
// The id of the page that shows the approval records of a kind, newest first: #<route>/id=history.
const HISTORY = "history";
// The commits of docs/approvals a page of the history reads.
const HISTORY_PAGE = 20;
// Where the approval records stand, and the identifier a record's name carries: docs/approvals/<identifier>-<blob12>.md.
const APPROVALS = "docs/approvals";
const RECORD_NAME = /^docs\/approvals\/(.+)-[0-9a-f]{12}\.md$/;
// The kind of job whose record holds the rounds of the architecture shown.
const ARCHITECTURE_JOB = "derive-architecture";

const recordOf = (id, kind, path, blob) => ({ path: `docs/approvals/${id}-${blob.slice(0, 12)}.md`,
  text: writeDocument(approvalSchema, { fields: { kind, file: path, blob } }) });

// A difference shows every line of the file, each marked as it is, so that its first change can stand in the middle of its box (`context` as large as the file).
const WHOLE = { context: Infinity };
// What this tab has shown of the files it lists, kept on the screen only: for the host of the repository the page shows, the tick each file shown offers on the
// list by the file's identifier, naming the text that was shown. The host is the tab's own for as long as the frame keeps it, and a repository's files are not another's.
const shownOn = new WeakMap();
function shownTicksOf(context) {
  const key = (context.product ?? context.instance)?.host ?? context;
  if (!shownOn.has(key)) shownOn.set(key, new Map());
  return shownOn.get(key);
}

// Opens each difference box in `scope` with its first changed line in the middle of the box: the line's middle at the box's middle, never above the box's start.
// The box must stand in the page, which gives it its geometry.
function centreFirstChange(scope) {
  const boxes = [];
  (function collect(node) {
    for (const kid of node.childNodes) {
      if (kid.nodeType !== 1) continue;
      if (kid.localName === "pre" && kid.className.split(" ").includes("diff")) boxes.push(kid); else collect(kid);
    }
  })(scope);
  for (const box of boxes) {
    box.setAttribute("tabindex", "0");
    const change = [...box.childNodes].find((node) => node.nodeType === 1 && /\bd(add|del)\b/.test(node.className));
    if (!change || typeof change.getBoundingClientRect !== "function") continue; // a page without geometry leaves the box at its start
    const line = change.getBoundingClientRect(), frame = box.getBoundingClientRect();
    box.scrollTop = Math.max(0, line.top - frame.top + box.scrollTop + line.height / 2 - box.clientHeight / 2);
  }
}

const shortBody =(body) => body.replace(/^---\n[^]*?\n---\n/, "");

// What an acceptance of several files came to: the commit, and each file left out with its reason and the names it rests on.
const reasonOf = (out) => `${out.reason}${out.names.length ? ` (${out.names.join(", ")})` : ""}`;
function acceptedMessage(result, idOf) {
  const message = el("p", "result", `Accepted in commit ${result.commit.slice(0, 7)}.`);
  for (const out of result.leftOut) message.append(el("br"), `${idOf(out.path)} was left out: ${reasonOf(out)}.`);
  return message;
}
// What a decision came to: a refusal as the service gives it, else the commit and each file left out.
const settled = (result, idOf) => (result.refusal ? el("p", "result problem", result.refusal) : acceptedMessage(result, idOf));
// What a refused acceptance of several files says: the failure, and each file it left out with its reason.
const refusedText = (failure, idOf) => [failure.message, ...(failure.leftOut ?? []).map((out) => `${idOf(out.path)}: ${reasonOf(out)}`)].join(" ");

// The files of the whole architecture in the order of its review page: the decision that states the system — the one that refines no
// other —, the subsystems' decisions — those that refine it and design modules —, the module files, the further decisions — those
// that refine it and design none —; each group by identifier.
function architectureOrder(entries, texts) {
  const group = (file) => {
    if (file.kind === "module") return 2;
    let fields;
    try { fields = readDocument(artifactSchemas().decision, file.path, texts.get(file.path)).fields; } catch { return 3; }
    if (!fields.refines) return 0;
    return [fields.designs ?? []].flat().length ? 1 : 3;
  };
  return entries.map((file) => ({ file, group: group(file) })).sort((a, b) => a.group - b.group || a.file.id.localeCompare(b.file.id)).map(({ file }) => file);
}

// The rounds of the newest job that drafted an architecture and has ended, as its record holds them, with why its loop stopped, which
// the record's `Left:` line states; null where there is no such job.
async function draftingRounds(where) {
  try {
    for await (const record of newestJobRecords(where.snapshot)) {
      if (record.kind !== ARCHITECTURE_JOB || !record.end) continue;
      if (!record.end.rounds.length) return null;
      return { rounds: record.end.rounds, stopped: stoppedBecause(await where.snapshot.read(record.path)) };
    }
    return null;
  } catch { return null; }
}

// Where a release test report lies, and the identifier its approval record carries: docs/approvals/release-v<version>-<blob12>.md.
const RELEASE_REPORT = /^docs\/tests\/releases\/(v\d{4}\.\d+\.\d+)\.md$/;

// The status of every reviewed file of a snapshot: MOD-approvals' `statuses`, and each release test report through `statusOf`.
function reviewedFiles(snapshot) {
  const all = new Map(statuses(snapshot));
  for (const path of snapshot.paths) {
    const version = RELEASE_REPORT.exec(path)?.[1];
    if (version && !all.has(path)) all.set(path, { id: `release-${version}`, kind: "release-report", status: statusOf(path, snapshot.blob(path), snapshot) });
  }
  return all;
}

// The service a descriptor names for its decisions (`accept`): the approvals of reviewed files, or the entries of a change queue through
// MOD-spec-changes. Each gives the flow the groups of files to list, whether a kind has a Review all, whether a product without a token
// is sent to the token's step, and accepts what was shown, once: a result { commit, leftOut } or { refusal } — a failure is thrown. `reject`
// rejects one item that was shown, with the person's reason: { commit } or, without a token, { fallback } — null for a kind that is not rejected.
const approvalsService = {
  tokenRequired: (context) => parseServer(context) === "gitlab",
  tokenNote: "A GitLab product is written with the project's own token. ",
  reviewAll: true,
  async groups({ snapshot, token }, kind) {
    const files = [...reviewedFiles(snapshot)].filter(([, each]) => each.kind === kind.kind).map(([path, each]) => ({ path, ...each })).sort((a, b) => a.id.localeCompare(b.id));
    // The files are named to Snapshot.readMany before they are read, and read together: one batch where the host has one, whatever the frame read ahead.
    await snapshot.readMany?.(files.map((file) => file.path));
    const bodies = await Promise.all(files.map(async (file) => (await snapshot.read(file.path)) ?? ""));
    const entries = files.map((file, at) => ({ id: file.id, name: file.id, title: kind.heading(bodies[at]).replace(/^\S+\s*/, ""), status: file.status, label: LABEL[file.status],
      tick: file.status === "accepted" ? null : { path: file.path, blob: snapshot.blob(file.path) } }));
    return [{ key: kind.kind, title: null, entries }];
  },
  accept: (where, shown, person) => acceptShown(where.host, shown, person),
  reject: (where, shown, person, reason) => rejectShown(where.host, shown, person, reason),
  // Whether an approval record's identifier is one of the kind's files in this snapshot.
  owns(snapshot, kind) {
    const ids = new Set([...reviewedFiles(snapshot).values()].filter((each) => each.kind === kind.kind).map((each) => each.id));
    return (id) => ids.has(id);
  },
};

// Accepting a release test report releases it (MOD-release-evidence.acceptAndRelease): one release for each report shown, on the person's click, with the reasons the
// person typed for its failing tests and worse rates (`limitations` of each file shown). A report that
// cannot be released — a failing test without its reason, a tag that stands — is left out with the service's words; when none can be, the first failure is thrown.
async function releaseShown(where, shown, person) {
  const today = new Date().toISOString().slice(0, 10);
  const recorded = [], leftOut = [];
  let commit = null, first = null;
  for (const { path, blob, limitations } of shown) {
    try {
      ({ commit } = await acceptAndRelease(where.host, { path, blob }, { limitations: limitations ?? {} }, person, today));
      recorded.push(path);
    } catch (failure) {
      first ??= failure;
      leftOut.push({ path, reason: failure.message, names: [] });
    }
  }
  if (recorded.length === 0) throw first;
  return { commit, recorded, leftOut };
}
// A release test report is decided by its release, not rejected (A PROPOSAL IS REJECTED WITH A REASON names use cases, decisions and SPEC change entries).
const releaseService = { ...approvalsService, accept: releaseShown, reject: null };
const SERVICES = { approvals: approvalsService, release: releaseService, queue: queueService };

export function reviewRoute(kind) {
  const service = SERVICES[kind.accept ?? "approvals"];
  const files = (snapshot) => [...reviewedFiles(snapshot)].filter(([, file]) => file.kind === kind.kind)
    .map(([path, file]) => ({ path, ...file })).sort((a, b) => a.id.localeCompare(b.id));
  const idOf = (path, snapshot) => reviewedFiles(snapshot).get(path)?.id ?? path;
  // The files Review all shows: those of the kind — for the architecture, of the whole of it — that are not accepted.
  const notAccepted = (snapshot) => [...reviewedFiles(snapshot)].filter(([, file]) => (kind.whole ?? [kind.kind]).includes(file.kind))
    .map(([path, file]) => ({ path, ...file })).filter((file) => file.status !== "accepted");

  // The snapshot the frame hands the route's `reads` before it calls `render` (common.mjs handedPlace).
  const place = handedPlace();
  // The editor of the page drawn last, or null where that page opened none: what the route's `leave` asks.
  let editor = null;
  // The render that started last: a render that started earlier and ends later draws into a page the frame has already replaced, and its editor is not the route's.
  let latest = 0;

  async function render(target, context, params) {
    const mine = ++latest;
    editor = null;
    beginSubject(context);
    const where = await readPlace(target, context, place);
    if (where === null) return;
    // A page that shows its editors later than it is drawn, such as the run of a drafting job, hands them to the route here.
    where.holdEditor = (held) => { if (mine === latest) editor = held; };
    // After a save the page shows the item again (UC-008 3a, UC-006 3a): drawn anew from the repository, with what the save came to.
    where.shownAgain = (id, message) => redraw(where, { id }, message);
    try {
      await view(where, params, () => mine === latest);
      await rememberSubject(where, kind, params);
    } catch (failure) {
      target.append(readProblem(failure, Boolean(where.token)));
    }
  }

  async function view(where, params, current) {
    const { target, snapshot } = where;
    const opened = async (made) => { const shown = (await made) ?? null; if (current()) editor = shown; };
    if (kind.edit) await opened(showEdit(where, kind, params));
    else if (params.edit && params.id && kind.save === "file") {
      const file = files(snapshot).find((candidate) => candidate.id === params.id);
      if (!file) target.append(el("p", "problem", `No ${kind.noun} ${params.id} on the default branch.`), reviewLink(where.context, `#${kind.route}`, null, `All ${kind.plural}`));
      else await opened(showFileEdit(where, kind, file));
    }
    else if (params.edit && params.id && kind.save === "entry") await opened(showEntryEdit(where, kind, params.id));
    else if (params.id === DRAFT && kind.draft) await showDraft(where, kind);
    else if (params.id === HISTORY) await showHistory(where, params);
    else if (params.id === REVIEW_ALL && service.reviewAll) await showAll(where);
    else if (params.id && service.view) await showEntry(where, params.id);
    else if (params.id) await showOne(where, params.id);
    else await showList(where);
  }

  // After a decision: the page again from the repository, and what the decision came to under it.
  const redraw = async (where, params, message, ...more) => {
    await render(where.target, where.context, params);
    if (message) where.target.append(message, ...more);
  };

  // For a kind whose Accept has the modules each accepted file changes checked (`affected`): the check of affected-modules.mjs, prepared for the first file the page offers,
  // whose note stands beside Accept; null where nothing is checked. A check that cannot be prepared is named beside Accept, and the acceptance then runs none.
  async function checkBeside(where, id) {
    if (!kind.affected || id === undefined) return null;
    try {
      return await affectedCheck(where, id);
    } catch (failure) {
      return { note: el("p", "affected-check problem", `Which modules the use cases change cannot be checked: ${failure.name}: ${failure.message}`), run: async () => [] };
    }
  }
  // What the check ran after an acceptance came to, for the files `result` recorded: one paragraph each; none without a check.
  const checked = async (check, result, snapshot) => (check && result?.recorded?.length ? check.run(result.recorded.map((path) => idOf(path, snapshot))) : []);

  async function showList(where) {
    const { target, token, context } = where;
    const groups = await service.groups(where, kind);
    const ticks = new Map();
    const bar = token ? button("btn accept-ticked", "Accept ticked (0)") : null;
    if (bar) bar.disabled = true;
    const tables = [];
    const rowFor = (file, withTick) => {
      const first = el("td");
      // Every file not accepted offers a tick (akmaier, 2026-11-01): it names the text this tab showed where the file was opened, else the text the list is drawn from.
      const shown = withTick && token && file.tick ? (shownTicksOf(context).get(file.id) ?? file.tick) : undefined;
      if (shown) {
        const box = el("input", "tick");
        box.type = "checkbox";
        box.setAttribute("aria-label", `Accept ${file.id}`);
        box.addEventListener("change", () => {
          if (box.checked) ticks.set(file.id, shown); else ticks.delete(file.id);
          bar.disabled = ticks.size === 0;
          bar.textContent = `Accept ticked (${ticks.size})`;
        });
        first.append(box);
      }
      // An approved entry of the instance's own SPEC is written by the instance's workflows: the row says why it is not written, and where they are turned on (UC-014 step 4, 4a).
      const unwritten = kind.save === "entry" && !context.product && file.status === "approved"
        ? [el("p", "why", NOT_WRITTEN), link("#get-your-own/step=actions", "actions-step", "Turn on the workflows")] : [];
      const row = el("tr", null, first, el("td", null, reviewLink(context, `#${kind.route}/id=${encodeURIComponent(file.id)}`, null, file.name)),
        el("td", null, file.title, ...unwritten), el("td", null, badge(file.status, file.label)));
      row.setAttribute("data-id", file.id);
      return row;
    };
    const head = () => el("thead", null, el("tr", null, el("th"), el("th", null, "Id"), el("th", null, "Title"), el("th", null, "Status")));
    const waiting = groups.flatMap((group) => group.entries).filter((file) => file.status !== "accepted" && file.status !== "in-SPEC");
    if (waiting.length) {
      const rows = el("tbody");
      for (const file of waiting) rows.append(rowFor(file, true));
      tables.push(el("section", "open-changes", el("h3", null, "Open or changed"), el("table", "list", head(), rows)));
    }
    for (const group of groups) {
      const rows = el("tbody");
      for (const file of group.entries) rows.append(rowFor(file, false));
      const table = el("table", "list", head(), rows);
      if (group.title === null) tables.push(table);
      else {
        const section = el("section", "queue", el("h3", null, group.title), table);
        section.setAttribute("data-folder", group.key);
        tables.push(section);
      }
    }
    target.append(el("h2", null, kind.title));
    if (service.reviewAll) target.append(reviewLink(context, `#${kind.route}/id=${REVIEW_ALL}`, "btn primary review-all", `Review all ${service.count ? service.count(groups) : notAccepted(where.snapshot).length} not accepted`));
    if (kind.draft) target.append(reviewLink(context, `#${kind.route}/id=${DRAFT}`, "draft-link", `Draft ${kind.plural}`));
    target.append(explain(kind.explain.list));
    const check = bar ? await checkBeside(where, waiting[0]?.id) : null;
    if (bar) {
      bar.addEventListener("click", async () => {
        bar.disabled = true;
        try {
          const result = await service.accept(where, [...ticks.values()], token.name);
          await redraw(where, {}, settled(result, (path) => idOf(path, where.snapshot)), ...await checked(check, result, where.snapshot));
        } catch (failure) {
          bar.disabled = ticks.size === 0;
          target.append(el("p", "result problem", refusedText(failure, (path) => idOf(path, where.snapshot))));
        }
      });
    } else if (context.product && service.tokenRequired(context)) {
      target.append(el("p", "problem", service.tokenNote, tokenStep(context)));
    }
    target.append(...tables);
    if (bar) target.append(bar, ...(check ? [check.note] : []));
    const arrange = arrangeLink(context, kind);
    if (arrange) target.append(arrange, " ");
    target.append(reviewLink(context, `#${kind.route}/id=${HISTORY}`, "history-link", `History of ${kind.plural}`));
  }

  // The history of the kind's changes: its approval records, newest first, each with the file it names, the person who committed it and the date. One readHistory of
  // docs/approvals gives the commits and the records each added; only the texts of the kind's records are read, in a batch where the host has one.
  async function showHistory(where, params) {
    const { target, snapshot, host } = where;
    const owns = service.owns(snapshot, kind);
    const added = [];
    // Twenty commits to a page, from the snapshot's commit, or from the parent of the last commit of the page before (`before`).
    const commits = await host.readHistory(APPROVALS, { ref: params.before ?? snapshot.commit ?? undefined, limit: HISTORY_PAGE });
    for (const entry of commits) {
      for (const change of entry.changes) {
        const id = change.change === "added" ? RECORD_NAME.exec(change.path)?.[1] : undefined;
        if (id !== undefined && owns(id)) added.push({ id, path: change.path, entry });
      }
    }
    await snapshot.readMany?.(added.map((record) => record.path));
    const rows = el("tbody");
    for (const { id, path, entry } of added) {
      const body = await snapshot.read(path);
      const fields = body === null ? {} : readDocument(approvalSchema, path, body).fields;
      const row = el("tr", null, el("td", null, fields.file ?? fields.proposal ?? path), el("td", null, entry.author.account ?? entry.author.name), el("td", null, entry.date));
      row.setAttribute("data-id", id);
      rows.append(row);
    }
    target.append(el("h2", null, `History of ${kind.plural}`), explain(kind.explain.list),
      el("table", "list history", el("thead", null, el("tr", null, el("th", null, "File"), el("th", null, "Person"), el("th", null, "Date"))), rows));
    const parent = commits.length === HISTORY_PAGE ? commits.at(-1).parents[0] : undefined;
    if (parent) target.append(reviewLink(where.context, `#${kind.route}/id=${HISTORY}/before=${encodeURIComponent(parent)}`, "older-link", "Older"));
  }

  // The file as it will be accepted, rendered with its diagrams; of the whole architecture's further decisions with their due diligence. Below its difference
  // a changed file's rendering stands in a section of its own (UC-008 3e, 2a, step 2).
  function renderedFile(file, body, changed) {
    const { rest, section: diligence } = kind.whole && file.kind === "architecture-decision" ? splitDueDiligence(shortBody(body)) : { rest: shortBody(body), section: null };
    const nodes = [renderArtifact(rest), ...(diligence !== null ? [dueDiligenceSection(diligence)] : [])];
    return changed ? [el("section", "rendered", el("h4", null, "The file as it will be accepted"), ...nodes)] : nodes;
  }

  // Review all: every file not yet accepted in sequence — a changed one as its difference to the last accepted text, a new one in
  // full — and, below them, the acceptance of exactly what is shown. For the architecture it is the page of the whole architecture:
  // decisions and module files in their order, a further decision with its due diligence, every decision or module file removed since its
  // acceptance with its impact list, and the rounds of the job that drafted them.
  async function showAll(where) {
    if (service.all) { await showAllEntries(where); return; }
    const { target, snapshot, token, host, context } = where;
    const reviewed = notAccepted(snapshot);
    const removed = kind.whole ? removedFiles(snapshot) : [];
    const texts = new Map();
    await snapshot.readMany?.(reviewed.map((file) => file.path));
    for (const file of reviewed) texts.set(file.path, (await snapshot.read(file.path)) ?? "");
    const shown = kind.whole ? architectureOrder(reviewed, texts) : reviewed.sort((a, b) => a.id.localeCompare(b.id));
    target.append(el("h2", null, kind.whole ? "Review all — the whole architecture" : `Review all — ${kind.title}`), explain(kind.explain.all));
    if (shown.length === 0 && removed.length === 0) {
      target.append(el("p", "nothing", `Nothing to review: every ${kind.noun} is accepted.`));
      return;
    }
    // `impacts`: the impact list shown for each file offered, by path, which the page lists by module once Accept has recorded the file (UC-023 step 6).
    const records = [], graphOf = graphOnce(snapshot), storedOf = storedOnce(snapshot), asked = new Map(), impacts = new Map();
    for (const file of shown) {
      const body = texts.get(file.path);
      const blob = snapshot.blob(file.path);
      const section = el("section", "review-file", el("h3", null, kind.heading(body)), badge(file.status, LABEL[file.status]));
      section.setAttribute("data-id", file.id);
      shownTicksOf(context).set(file.id, { path: file.path, blob });
      let withImpact = true;
      if (file.status === "changed") {
        const diff = el("section", "accepted-diff", el("h4", null, "Changed since it was last accepted"));
        let last = null, stored = null;
        try {
          stored = kind.restsOn ? await fromStored(file, snapshot, host, storedOf) : null;
          last = stored?.last ?? await lastAcceptedText(file.id, host);
          if (last) diff.append(showDifference(last.text, body, WHOLE));
        } catch (failure) {
          diff.append(el("p", "problem", failure.message));
        }
        section.append(diff, ...renderedFile(file, body, true));
        if (kind.restsOn && last) {
          const impact = stored ? { shown: stored.shown, impact: stored.impact } : await changeImpact(file, last, body, graphOf);
          withImpact = !impact.problem;
          section.append(impact.problem ?? impact.shown);
          if (impact.impact) impacts.set(file.path, impact.impact);
        }
      } else {
        section.append(...renderedFile(file, body, false));
      }
      if (kind.restsOn) {
        const open = await acceptanceBlockers(file.path, snapshot);
        if (open.length) {
          const names = el("ul");
          for (const name of open) names.append(el("li", "open-name", name));
          section.append(el("section", "rests-on", el("h4", null, "Rests on what is not accepted"), names));
        }
      }
      if (kind.limitations) { asked.set(file.path, reportSections(body)); section.append(...asked.get(file.path).nodes); }
      if (withImpact) records.push({ file, record: recordOf(file.id, file.kind, file.path, blob), blob });
      target.append(section);
      centreFirstChange(section);
    }
    // A removed decision or module file: its last accepted text against the empty text, which is the text shown, and its impact list; one
    // lastAcceptedText each, which gives its path. Without its last text or its impact list it is shown and not offered.
    const empty = removed.length ? await blobSha("") : null;
    for (const gone of removed) {
      const diff = el("section", "accepted-diff", el("h4", null, "Removed since it was last accepted"));
      let last = null;
      try {
        last = await lastAcceptedText(gone.id, host);
        diff.append(last ? showDifference(last.text, "", WHOLE) : el("p", "problem", `No approval record names a text of ${gone.id}.`));
      } catch (failure) {
        diff.append(el("p", "problem", failure.message));
      }
      const section = el("section", "review-file", el("h3", null, last ? kind.heading(last.text) : gone.id), badge("removed", "removed since acceptance"), diff);
      section.setAttribute("data-id", gone.id);
      if (last) {
        const file = { id: gone.id, kind: gone.kind, path: last.path };
        const impact = await changeImpact(file, last, null, graphOf);
        section.append(impact.problem ?? impact.shown);
        if (!impact.problem) { records.push({ file, record: recordOf(file.id, file.kind, file.path, empty), blob: empty }); impacts.set(file.path, impact.impact); }
      }
      target.append(section);
      centreFirstChange(section);
    }
    if (kind.whole) {
      const rounds = await draftingRounds(where);
      if (rounds) target.append(roundsSection(rounds.rounds, rounds.stopped));
    }
    const heading = `Accept all ${shown.length + removed.length} shown`;
    if (token) {
      const accept = button("btn accept-all", heading);
      const check = await checkBeside(where, records[0]?.file.id);
      accept.addEventListener("click", async () => {
        accept.disabled = true;
        try {
          const result = await service.accept(where, records.map(({ file, blob }) => ({ path: file.path, blob, ...(asked.has(file.path) && { limitations: asked.get(file.path).reasons() }) })), token.name);
          const listed = await affectedModules((result.recorded ?? []).map((path) => impacts.get(path)).filter(Boolean), graphOf);
          await redraw(where, { id: REVIEW_ALL }, acceptedMessage(result, (path) => idOf(path, snapshot)), ...listed, ...await checked(check, result, snapshot));
        } catch (failure) {
          accept.disabled = false;
          target.append(el("p", "result problem", refusedText(failure, (path) => idOf(path, snapshot))));
        }
      });
      target.append(accept, ...(check ? [check.note] : []));
    } else if (parseServer(context) === "gitlab") {
      target.append(el("p", "problem", "A GitLab product is written with the project's own token. ", tokenStep(context)));
    } else {
      for (const { file, record } of records) {
        const offered = fallbackAcceptLink(record, snapshot);
        target.append(el("p", "github-fallback", `${file.id}: `, link(offered.url, "github-page", "Open GitHub's page to commit the record")));
      }
    }
  }

  // Review all of a change queue's kind: every open entry of every queue in sequence, as its page draws it, and below them the acceptance of exactly what is shown,
  // in one commit; an entry that changed after it was shown is left out and named.
  async function showAllEntries(where) {
    const { target, token, context } = where;
    const entries = await service.all(where, (other) => reviewHref(where.context, `#${kind.route}/id=${encodeURIComponent(other)}`));
    target.append(el("h2", null, `Review all — ${kind.title}`), explain(kind.explain.all));
    if (entries.length === 0) {
      target.append(el("p", "nothing", `Nothing to review: every ${kind.noun} is accepted.`));
      return;
    }
    for (const entry of entries) {
      const section = el("section", "review-file", el("h3", null, entry.title), badge(entry.status, entry.label), ...entry.nodes);
      section.setAttribute("data-id", entry.id);
      if (entry.shown) shownTicksOf(context).set(entry.id, entry.shown[0]);
      target.append(section);
    }
    const shown = entries.flatMap((entry) => entry.shown);
    if (token) {
      const accept = button("btn accept-all", `Accept all ${shown.length} shown`);
      accept.addEventListener("click", async () => {
        accept.disabled = true;
        try {
          const changed = await service.changedSince(where, shown);
          // An entry that waits for an anchor goes only with the entry that creates it: left out with it, and named.
          const left = new Set(changed.map((out) => out.path));
          for (let grew = true; grew;) {
            grew = false;
            for (const entry of entries) {
              if (entry.shown && entry.after && left.has(entry.after) && !left.has(entry.id)) {
                left.add(entry.id);
                changed.push({ path: entry.id, reason: `it goes with ${entry.after}, which was left out`, names: [] });
                grew = true;
              }
            }
          }
          const rest = shown.filter((each) => !left.has(service.idOf(each)));
          const result = rest.length ? await service.accept(where, rest, token.name) : { commit: null, leftOut: [] };
          const message = result.refusal ? el("p", "result problem", result.refusal)
            : result.commit ? acceptedMessage({ ...result, leftOut: changed }, (path) => path)
              : el("p", "result problem", changed.map((out) => `${out.path} was left out: ${reasonOf(out)}.`).join(" "));
          await redraw(where, { id: REVIEW_ALL }, message);
        } catch (failure) {
          accept.disabled = false;
          target.append(el("p", "result problem", refusedText(failure, (path) => path)));
        }
      });
      target.append(accept);
    } else if (context.product) {
      target.append(el("p", "problem", service.tokenNote, tokenStep(context)));
    } else {
      for (const entry of entries) if (entry.shown) offerRecord(target, entry.record, where.snapshot, context);
    }
  }

  // Without a token: the record alone on GitHub's page for the instance's own SPEC; a GitLab product, or a record there is none of, is sent to the token's step.
  function offerRecord(target, record, snapshot, context) {
    const offered = record ? fallbackAcceptLink(record, snapshot) : { refused: true };
    if (offered.refused) {
      target.append(el("p", "problem", service.tokenNote, tokenStep(context)));
      return;
    }
    const copy = (text) => { const b = button("btn copy", "Copy"); b.addEventListener("click", () => globalThis.navigator?.clipboard?.writeText?.(text)); return b; };
    target.append(el("div", "github-fallback", explain(kind.explain.fallback),
      link(offered.url, "github-page", "Open GitHub's page to commit the record"),
      el("p", null, "Path ", el("code", "record-path", offered.path), " ", copy(offered.path)),
      el("pre", "record", offered.text), copy(offered.text)));
  }

  // One entry of a change queue: its sections as the service draws them, what holds it back or what a click accepts, and without a token the record.
  async function showEntry(where, id) {
    const { target } = where;
    const entry = await service.view(where, id, (other) => reviewHref(where.context, `#${kind.route}/id=${encodeURIComponent(other)}`));
    if (!entry) {
      target.append(el("p", "problem", `No ${kind.noun} ${id} on the default branch.`), reviewLink(where.context, `#${kind.route}`, null, `All ${kind.plural}`));
      return;
    }
    if (entry.shown) shownTicksOf(where.context).set(id, entry.shown[0]);
    target.append(el("h2", null, entry.title), badge(entry.status, entry.label),
      ...(entry.status === "approved" ? [el("p", "approved-note", APPROVED_NOTE)] : []), explain(kind.explain.one), ...entry.nodes);
    if (entry.edit) target.append(reviewLink(where.context, `#${kind.route}/id=${encodeURIComponent(id)}/edit=1`, "edit-link", "Edit"));
    offerEntryAcceptance(where, id, entry);
    // Beside Accept, Reject, for every entry that is not decided — open, stale or waiting for its anchor (UC-006 4a).
    if (entry.shown && service.reject) target.append(rejectOffer(where, id, entry.shown[0]));
  }

  // What holds an entry back, or what a click accepts of it — or, without a token, the record.
  function offerEntryAcceptance(where, id, entry) {
    const { target, token, snapshot } = where;
    if (entry.hold) { target.append(entry.hold); return; }
    if (!entry.shown) return;
    if (!token) { offerRecord(target, entry.record, snapshot, where.context); return; }
    const accept = button("btn accept", "Accept");
    accept.addEventListener("click", async () => {
      accept.disabled = true;
      try {
        await redraw(where, { id }, settled(await service.accept(where, entry.shown, token.name), (path) => idOf(path, snapshot)));
      } catch (failure) {
        accept.disabled = false;
        target.append(el("p", "result problem", refusedText(failure, (path) => idOf(path, snapshot))));
        if (failure.name === "PermissionMissing") offerRecord(target, entry.record, snapshot, where.context);
      }
    });
    target.append(accept);
  }

  // The Reject of one item shown (rejectSection): the service's reject with the person's reason, and the page drawn again from the repository after it.
  function rejectOffer(where, id, shown) {
    return rejectSection(where, id, kind.explain.fallback, (reason) => service.reject(where, shown, where.token?.name ?? "a reviewer", reason),
      (message) => redraw(where, { id }, message));
  }

  async function showOne(where, id) {
    const { target, snapshot, token, host } = where;
    const file = files(snapshot).find((candidate) => candidate.id === id);
    if (!file) {
      target.append(el("p", "problem", `No ${kind.noun} ${id} on the default branch.`), reviewLink(where.context, `#${kind.route}`, null, `All ${kind.plural}`));
      return;
    }
    const body = await snapshot.read(file.path);
    const blob = snapshot.blob(file.path);
    shownTicksOf(where.context).set(file.id, { path: file.path, blob });
    target.append(el("h2", null, kind.heading(body)), badge(file.status, LABEL[file.status]),
      el("p", "shown", `Text shown: blob ${blob.slice(0, 12)}`), explain(kind.explain.one));
    let last = null, stored = null;
    if (file.status === "changed") {
      const diff = el("section", "accepted-diff", el("h3", null, "Changed since it was last accepted"), explain(kind.explain.changed));
      try {
        stored = kind.restsOn ? await fromStored(file, snapshot, host, storedOnce(snapshot)) : null;
        last = stored?.last ?? await lastAcceptedText(file.id, host);
        if (last) diff.append(showDifference(last.text, body, WHOLE));
      } catch (failure) {
        diff.append(el("p", "problem", failure.message));
      }
      target.append(diff);
      centreFirstChange(diff);
    }
    target.append(file.status === "changed" ? el("section", "rendered", el("h3", null, "The file as it will be accepted"), renderArtifact(shortBody(body))) : renderArtifact(shortBody(body)));
    if (kind.save === "file" && (token || parseServer(where.context) !== "gitlab")) {
      target.append(reviewLink(where.context, `#${kind.route}/id=${encodeURIComponent(file.id)}/edit=1`, "edit-link", "Edit"));
    }
    if (kind.draft && file.status !== "accepted") {
      const notes = await jobNotes(snapshot, file.id, file.path);
      if (notes.length) {
        const list = el("ul");
        for (const note of notes) list.append(el("li", null, note));
        target.append(el("section", "job-notes", el("h3", null, "Notes of the job that wrote it"), list));
      }
    }
    if (file.status === "accepted") return;
    await offerAcceptance(where, file, body, blob, last, stored);
    // Beside Accept, Reject (UC-008 3f, UC-023 5b).
    if (service.reject) target.append(rejectOffer(where, id, { path: file.path, blob }));
  }

  // What a click accepts of one file that is not accepted: its impact list and what it rests on, then Accept — or, without a token, GitHub's page.
  async function offerAcceptance(where, file, body, blob, last, stored) {
    const { target, snapshot, token } = where;
    const id = file.id;
    const asked = kind.limitations ? reportSections(body) : null;
    if (asked) target.append(...asked.nodes);
    // The impact list shown, which the page lists by module once Accept has recorded the file (UC-023 step 6).
    let shownImpact = null;
    const graphOf = graphOnce(snapshot);
    if (kind.restsOn && last) {
      const impact = stored ? { shown: stored.shown, impact: stored.impact } : await changeImpact(file, last, body, graphOf);
      if (impact.problem) { target.append(impact.problem); return; }
      target.append(impact.shown);
      shownImpact = impact.impact;
    }
    if (kind.restsOn) {
      const open = await acceptanceBlockers(file.path, snapshot);
      if (open.length) {
        const rests = el("section", "rests-on", el("h3", null, "Rests on what is not accepted"));
        const names = el("ul");
        for (const name of open) names.append(el("li", "open-name", name));
        rests.append(el("p", null, `${file.id} can be accepted once everything it names is accepted.`), names);
        target.append(rests);
        // Accept stays beside the section, disabled and without a listener: a click writes nothing (UC-023 4b).
        if (token) {
          const waiting = button("btn accept", "Accept");
          waiting.disabled = true;
          target.append(waiting);
        }
        return;
      }
    }
    const record = recordOf(file.id, kind.kind, file.path, blob);
    const result = el("p", "result");
    const offerGitHub = () => offerRecord(target, record, snapshot, where.context);
    if (token) {
      const accept = button("btn accept", "Accept");
      const check = await checkBeside(where, id);
      accept.addEventListener("click", async () => {
        accept.disabled = true;
        try {
          const done = await service.accept(where, [{ path: file.path, blob, ...(asked && { limitations: asked.reasons() }) }], token.name);
          const listed = shownImpact && done.recorded?.includes(file.path) ? await affectedModules([shownImpact], graphOf) : [];
          await redraw(where, { id }, el("p", "result", `Accepted in commit ${done.commit.slice(0, 7)}.`), ...listed, ...await checked(check, done, snapshot));
        } catch (failure) {
          accept.disabled = false;
          result.textContent = refusedText(failure, (path) => idOf(path, snapshot));
          target.append(result);
          if (failure.name === "PermissionMissing") offerGitHub();
        }
      });
      target.append(accept, ...(check ? [check.note] : []));
    } else offerGitHub();
  }

  // The frame asks this before it shows another route: the editor of the page drawn last closes, asking first, or stays.
  function leave() {
    if (editor === null) return true;
    const closed = editor.close();
    if (closed) editor = null;
    return closed;
  }

  // The frame asks this before the tab closes: whether the editor of the page drawn last holds unsaved changes, without asking anyone.
  const unsaved = () => editor !== null && editor.unsaved();

  // The folders of the repository the page these `params` address reads (MOD-site-frame's Route `folders`), from the descriptor's `folders`: the list,
  // Review all and one file name theirs; drafting, the history and an editor name none — null —, and the frame gives them the whole tree.
  const folders = (params) => {
    if (params.edit || params.id === DRAFT || params.id === HISTORY) return null;
    if (!params.id) return kind.folders.list;
    return params.id === REVIEW_ALL ? kind.folders.all : kind.folders.file;
  };

  return { name: kind.route, entry: kind.entry, title: kind.title, render, subject: (params, context) => subjectOf(kind, params, context), leave, unsaved,
    reads: place.reads, ...(kind.folders ? { folders } : {}) };
}
