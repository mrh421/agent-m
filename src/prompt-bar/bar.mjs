// MOD-prompt-bar, bar.mjs — the bar (docs/architecture/MOD-prompt-bar.md: Parts, Interfaces: startPromptBar, latestDraft, dropDraft, currentJob): the
// selector, the input, *Send* and *Stop*, the conversation, the answer, and the hand-over a participant proposes: shown with its kind, what it
// works on, its task, the participant and its route, checked with the product's start rules (hand-over.mjs), queued by *Hand over* and followed
// until it has ended (follow.mjs), with *Stop* cancelling it.
//
// Module: MOD-prompt-bar
//
// THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION. Nothing is read from a participant's
// route, written or sent while the bar is drawn: *Send* is the one click that sends a message, and the one that, with recording on, writes
// the conversation record first, and the request of whatever its answer hands on; only a click the browser marks as a person's (`isTrusted`)
// does. The conversation lives in the tab's values (MOD-browser-store): `prompt-bar:conversation`, a list of Messages; `prompt-bar:draft`, the
// latest ConversationDraft; `prompt-bar:records`, the record each repository's part of the conversation is appended to; and `prompt-bar:job`,
// the job handed over and followed while it runs ({ id, address }).

import { readTabValue, writeTabValue } from "../browser-store/index.mjs";
import { renderArtifact } from "../markdown-render/index.mjs";
import { eligible } from "../participant-list/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { endpointsOffered, offeredAmong, placeOf, readParticipants, throughActions } from "./offer.mjs";
import { followJob } from "./follow.mjs";
import { assess, queue, spawnEndpointJob, worksOnOf } from "./hand-over.mjs";
import { appendToConversation, conversationPath, recordingOf } from "./record.mjs";
import { BAR_KIND, defaultSnapshot, personOf, prepareHandOver, prepareMessage, runMessage, shown, whyNot } from "./send.mjs";

const CONVERSATION = "prompt-bar:conversation";
const DRAFT = "prompt-bar:draft";
const RECORDS = "prompt-bar:records";
const JOB = "prompt-bar:job";
const CHOSEN = "prompt-bar:participant";
const HEIGHT = "prompt-bar:height";
// The bar's height a person sets with its grip, in pixels: at least LOWEST, at most nine tenths of the window; a key press moves it by STEP.
const LOWEST = 120, STEP = 40;
const FIXED = "position: fixed; bottom: 0; left: 0; right: 0;";

// The label of the button that sends: *Spawn job* where the message runs through GitHub Actions (offer.mjs throughActions), *Send* otherwise.
export const SEND = "Send", SPAWN = "Spawn job";

const el = (name, className, ...children) => {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
};
const button = (className, text) => {
  const node = el("button", className, text);
  node.type = "button";
  return node;
};
// A run's address as a link, when it is a web address: a record may name anything as its log.
const linkTo = (address) => {
  const node = el("a", "run", address);
  if (/^https?:\/\//.test(address)) node.setAttribute("href", address);
  return node;
};

// The server's page of the repository's secrets (MOD-repository-hosts' webLinks), as a link.
const secretsLink = (host) => {
  const node = el("a", "secrets-link", "Secrets of this repository");
  node.setAttribute("href", host.webLinks().secrets);
  return node;
};

// The conversation the tab keeps, its moments read back as dates; empty where the tab keeps none or cannot.
function conversationOf(store) {
  try {
    return (readTabValue(store, CONVERSATION) ?? []).map((message) => ({ ...message, at: new Date(message.at) }));
  } catch {
    return [];
  }
}

// The message of this page's conversation that is running in this tab; one conversation runs one message at a time.
let running = null;

/**
 * currentJob() -> { kind, participant, started, state: "running" } | null — the message running in this tab now, for the list of every job.
 */
export function currentJob() {
  return running === null ? null : { ...running, state: "running" };
}

/**
 * latestDraft(store: Store, subject: string) -> ConversationDraft | null — the conversation's latest draft, if it was drafted on that subject.
 */
export function latestDraft(store, subject) {
  const draft = readTabValue(store, DRAFT);
  return draft !== null && draft.subject === subject ? draft : null;
}

/**
 * dropDraft(store: Store, subject: string) -> void — drops the conversation's latest draft, if it was drafted on that subject; the draft of another subject is left.
 */
export function dropDraft(store, subject) {
  if (latestDraft(store, subject) !== null) writeTabValue(store, DRAFT, null);
}

// What a failure says: its name and message.
const said = (failure) => `${failure.name ?? "Error"}: ${failure.message}`;

/**
 * startPromptBar(target: Element, setup: { page: "main" | "review", store: Store, instance: { repository: string, host: Host },
 * product: () -> { address: string, host: Host } | null, subject: () -> Subject, explain: (topic: string) -> Element,
 * go: (route: string, params?: Record<string, string>) -> void }) -> { stop: () -> void } — draws the bar into `target` once the
 * instance's participants are read, and keeps it for the life of the page. With no participant offered it draws nothing and says nothing
 * (UC-049 1a). It crosses the network through the hosts and the participant's route; a failure of either is shown in the bar by name, and
 * nothing is thrown to the caller. `stop` removes the bar and aborts a message that is running.
 */
export function startPromptBar(target, setup) {
  const { store, instance } = setup;
  const state = { stopped: false, controller: null, follower: null, following: false };
  let reached = [], offered = [], recording = false, instanceWeb = null;

  const status = el("section", "status");
  const followed = el("section", "following");
  const conversation = el("ul", "conversation");
  const recorded = el("p", "recording", "This conversation is recorded in the repository of the page it is held on.");
  const input = el("textarea", "instruction");
  const send = button("send", SEND);
  const clear = button("clear", "Clear conversation");
  const stop = button("stop", "Stop");
  stop.disabled = true;
  let selector = null;
  let offeredNames = null;
  const chooser = el("div", "chooser");

  const show = (...nodes) => status.replaceChildren(...nodes);
  const problem = (text) => el("p", "problem", text);
  const showRecording = (on) => {
    recording = on;
    recorded.hidden = !on;
  };
  const chosen = () => offered.find((each) => each.name === (selector.value ?? offered[0].name)) ?? offered[0];
  // A participant's answer stands once, in the conversation: its text is the bar's `answer`.
  const line = (message) => {
    const text = el("div", message.from === "participant" ? "text answer" : "text");
    if (message.from === "participant") text.append(renderArtifact(message.text, { frontMatter: "hidden" }));
    else text.append(message.text);
    return el("li", `message ${message.from}`, el("span", "who", message.who), " ", text);
  };
  const keep = (messages) => {
    writeTabValue(store, CONVERSATION, messages);
    conversation.replaceChildren(...messages.map(line));
  };

  // The repository the conversation is held on: the product's, or the instance's.
  function pageOf() {
    const product = setup.product();
    return product ? { address: product.address, host: product.host } : { address: instanceWeb, host: instance.host };
  }

  // Appends one entry to the conversation record of the repository the page is held on: the record the tab keeps for it, or a new one.
  async function record(page, person, entry) {
    const records = readTabValue(store, RECORDS) ?? {};
    const held = records[page.address] ?? { path: conversationPath(entry.at), startedBy: person };
    const done = await appendToConversation(page.host, held, entry);
    writeTabValue(store, RECORDS, { ...records, [page.address]: held });
    return done;
  }

  // The job handed over is kept in the tab so that the next page goes on following it; a tab that keeps nothing follows it on this page only.
  function keepJob(job) {
    try {
      writeTabValue(store, JOB, job);
    } catch { /* the tab keeps no values */ }
  }

  // Stop is for the message that runs in this tab, or else for the job that is followed.
  const refreshStop = () => { stop.disabled = state.controller === null && !state.following; };

  // The job followed, as the last poll saw it.
  function showJob(view) {
    state.following = view.end === null;
    if (view.end !== null) keepJob(null);
    refreshStop();
    const route = view.route ?? "";
    const waiting = view.end !== null || route === "" ? [] : [el("p", "waiting", route.startsWith("bridge ") ? `waiting for the Bridge ${route.slice("bridge ".length)}` : "waiting for GitHub Actions")];
    const secret = view.missingSecret === null ? [] : [el("p", "missing-secret", `Not run: the secret ${view.missingSecret} is missing. Add it on the server's page of this repository's secrets: `, secretsLink(pageOf().host))];
    const run = view.address === null ? [] : [el("p", "run-address", "Run: ", linkTo(view.address))];
    const ended = view.end === null ? [] : [el("p", "ended", `Ended: ${view.end.state}`),
      ...(view.end.reason ? [el("p", "reason", `Reason: ${view.end.reason}`)] : []),
      ...(view.end.results.length ? [el("ul", "commits", ...view.end.results.map((each) => el("li", "commit", each)))] : [])];
    followed.replaceChildren(el("h3", null, `Handed over: ${view.id}`), el("p", "state", `State: ${view.state ?? "reading…"}`), ...waiting, ...secret, ...run,
      ...(view.lines.length ? [el("pre", "log", view.lines.join("\n"))] : []), ...ended, ...(view.cancel ? [el("p", "cancel", view.cancel)] : []),
      ...(view.problem ? [problem(view.problem)] : []));
    // The run's answer joins the conversation once (UC-049 4a.4).
    if (view.answer && state.answered !== view.id) {
      state.answered = view.id;
      keep([...conversationOf(store), { at: new Date(), from: "participant", who: state.spawnedBy ?? view.id, text: view.answer, subject: setup.subject().key }]);
    }
  }

  function follow(job) {
    state.follower?.stop();
    state.following = true;
    state.follower = followJob({ id: job.id, address: job.address, host: pageOf().host, store, show: showJob });
    refreshStop();
  }

  // The hand-over the participant proposed: whether the product's start rules let it start and the route it would take; *Hand over* queues it, on a person's click, and the bar follows it.
  async function proposeHandOver(section, handOver, participant, subject) {
    const outcome = el("div", "outcome", el("p", "checking", "Checking whether it can start…"));
    section.append(el("p", "proposed", `Participant: ${participant.name} — ${placeOf(participant)}`), outcome);
    const render = (assessment) => {
      const parts = [el("p", "route", assessment.route ? `Route: ${assessment.routeText}` : `Route: not available — ${assessment.routeText}`)];
      if (assessment.needsWorkflow) {
        const set = button("settings-link", "Set up the job workflow");
        set.addEventListener("click", () => setup.go("settings"));
        parts.push(set);
      }
      if (assessment.reasons.length) parts.push(el("ul", "start-reasons", ...assessment.reasons.map((each) => el("li", "reason", each))));
      outcome.replaceChildren(...parts);
    };
    // Queued at once where nothing keeps the work from starting: the person's Send, whose answer proposed it, is the request (UC-049 4a.2).
    async function queueNow(assessment) {
      try {
        const page = pageOf();
        // The job takes the one parameter of the subject's paramsFor beside what it works on, the person's own `source` (THE PERSON WHO PROMPTS IS A SOURCE) where the subject gives one —
        // no other, so that no message and no page text enters the job's record (A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON).
        const source = subject.paramsFor(participant).source;
        const fresh = assessment;
        const conversation = (await recordingOf(fresh.instanceSnapshot)) ? (readTabValue(store, RECORDS) ?? {})[page.address]?.path ?? null : null;
        const queued = await queue({ handOver, participant, assessment: fresh, store, instance, page, ofProduct: setup.product() !== null, conversation, source });
        outcome.append(el("p", "queued", `Queued as ${queued.id}.`));
        keepJob({ id: queued.id, address: page.address });
        follow({ id: queued.id, address: page.address });
        if (conversation !== null) {
          try {
            await record(page, queued.person, { at: new Date(), job: queued.id });
          } catch (failure) {
            outcome.append(problem(`The hand-over could not be recorded in the conversation. ${said(failure)}`));
          }
        }
      } catch (failure) {
        const findings = failure?.name === "NotStartable" && Array.isArray(failure.findings) ? failure.findings : [];
        outcome.append(problem(findings.length > 0 ? "Nothing was queued." : `Nothing was queued. ${said(failure)}`),
          ...(findings.length > 0 ? [el("ul", "reasons", ...findings.map((each) => el("li", "reason", shown(each))))] : []));
      }
    }
    try {
      const assessment = await assess({ handOver, participant, instance, page: pageOf() });
      render(assessment);
      if (assessment.reasons.length === 0 && assessment.route !== null) await queueNow(assessment);
    } catch (failure) {
      outcome.replaceChildren(problem(`It could not be checked whether this can start. ${said(failure)}`));
    }
  }

  function showAnswer(result, ready, subject, participant) {
    const draft = result.draft;
    if (result.stoppedBecause === "unusable" || draft === null || draft === undefined) {
      const raw = el("details", "raw", el("summary", null, "The answer as received"), el("pre", null, result.raw ?? ""));
      show(problem("The participant's answer could not be read. Nothing was changed."), raw);
      return null;
    }
    const text = typeof draft.answer === "string" ? draft.answer : "";
    const left = [...result.remaining, ...result.forPerson];
    const parts = [el("p", "rounds", `Rounds: ${result.rounds.length}`)];
    if (left.length) parts.push(el("ul", "left", ...left.map((each) => el("li", "finding", shown(each)))));
    // The edits the participant proposed are a draft, which the review pages show against the current text.
    if (Array.isArray(draft.edits) && draft.edits.length > 0) parts.push(reviewButton(subject, ready.prepared.kind.name, participant, ready.prepared.params, result));
    status.append(...parts);
    return text;
  }

  // *Review the draft*: keeps the ConversationDraft in the tab and goes to the subject's draft route, or to the review pages' `draft` for the subject's key. The parameters kept are
  // those of the job less `page`, so that the draft route's own page stands as the context of a follow-up.
  function reviewButton(subject, kind, participant, params, result) {
    const review = button("review", "Review the draft");
    review.addEventListener("click", () => {
      const { page: _page, ...kept } = params;
      writeTabValue(store, DRAFT, { subject: subject.key, kind, participant: participant.name, params: kept, result });
      setup.go(subject.draftRoute ?? `draft/subject=${encodeURIComponent(subject.key)}`);
    });
    return review;
  }

  // A hand-over the participant proposed, carried out without a further click (UC-049 4a): in this tab where its kind's result waits for the person and the participant can do the
  // kind — prepared as a message is, its draft kept for *Review the draft* —, else queued where the start rules let it start (proposeHandOver).
  async function handOn(handOver, participant, subject, conversation, signal) {
    const section = el("section", "hand-over", el("h3", null, "The participant hands this on"),
      el("p", "kind", `Kind: ${handOver.kind}`), el("p", "works-on", `Works on: ${worksOnOf(handOver).join(", ")}`), el("p", "task", `Task: ${handOver.task}`));
    status.append(section);
    let kind;
    try {
      kind = await kindOf(handOver.kind);
    } catch (failure) {
      section.append(problem(`Nothing was handed on. ${said(failure)}`));
      return;
    }
    // The conversation itself handed on (the bar's own kind) goes on as a job, as a kind the tab cannot run does: the endpoint's own (UC-049 4a.2).
    if (kind.name === BAR_KIND || kind.review !== "person" || eligible([participant], { capabilities: kind.needs }).eligible.length === 0) {
      await proposeHandOver(section, handOver, participant, subject);
      return;
    }
    let ready;
    try {
      ready = await prepareHandOver({ handOver, subject, participant, conversation, store, instance, product: setup.product() });
    } catch (failure) {
      section.append(problem(`Nothing was run. ${said(failure)}`));
      return;
    }
    const reasons = whyNot(ready.prepared, offered);
    if (reasons.length) {
      section.append(problem("Nothing was run."), el("ul", "reasons", ...reasons.map((reason) => el("li", "reason", reason))));
      return;
    }
    section.append(el("p", "running", `Running ${handOver.kind} in this tab…`));
    running = { kind: handOver.kind, participant: participant.name, started: new Date() };
    const result = await runMessage(ready, { signal });
    if (result.stoppedBecause === "unusable" || !result.draft) {
      section.append(problem("The answer could not be read. Nothing was changed."), el("details", "raw", el("summary", null, "The answer as received"), el("pre", null, result.raw ?? "")));
      return;
    }
    const left = [...result.remaining, ...result.forPerson];
    section.append(el("p", "rounds", `Rounds: ${result.rounds.length}`), ...(left.length ? [el("ul", "left", ...left.map((each) => el("li", "finding", shown(each))))] : []),
      reviewButton(subject, handOver.kind, participant, ready.prepared.params, result));
  }

  async function onSend(event) {
    if (event?.isTrusted !== true) return; // THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK: a script's click sends nothing and records nothing
    if (state.controller || state.stopped) return;
    const instruction = input.value.trim();
    if (instruction === "") { show(problem("Write a message first.")); return; }
    const participant = await rejudged();
    if (participant === null) { show(problem("Nothing was sent. No participant can do this kind of message.")); return; }
    if (throughActions(participant, store)) { await onSpawn(participant, instruction); return; }
    const controller = new AbortController();
    state.controller = controller;
    send.disabled = true;
    show();
    try {
      const subject = setup.subject();
      const earlier = conversationOf(store);
      let ready;
      try {
        ready = await prepareMessage({ subject, participant, instruction, conversation: earlier, store, instance, product: setup.product() });
      } catch (failure) {
        show(problem(`Nothing was sent. ${said(failure)}`));
        return;
      }
      showRecording(ready.recording);
      const reasons = whyNot(ready.prepared, offered);
      if (reasons.length) {
        show(problem("Nothing was sent."), el("ul", "reasons", ...reasons.map((reason) => el("li", "reason", reason))));
        return;
      }
      const to = ready.prepared.destinations.map((each) => el("li", "destination", `${each.participant.name} — ${each.place || "no processing place declared"}`));
      show(el("p", "sends", "Sent to:"), el("ul", "destinations", ...to),
        el("p", "limit", `The correction loop runs at most ${ready.prepared.limit} rounds.`));
      const who = ready.person ?? "person";
      if (ready.recording) {
        if (ready.person === null) {
          show(problem("Nothing was sent. Conversations are recorded here, and no token for this repository is stored in this browser to record with."));
          return;
        }
        try {
          await record(ready.page, ready.person, { at: new Date(), who, page: subject.title, text: instruction, withheld: subject.withhold?.(instruction) ?? undefined });
        } catch (failure) {
          show(problem(`Nothing was sent. The message could not be recorded: ${said(failure)}`));
          return;
        }
      }
      keep([...earlier, { at: new Date(), from: "person", who, text: instruction, subject: subject.key }]);
      input.value = "";
      running = { kind: BAR_KIND, participant: participant.name, started: new Date() };
      stop.disabled = false;
      const result = await runMessage(ready, { signal: controller.signal });
      const answered = showAnswer(result, ready, subject, participant);
      if (answered !== null) {
        keep([...conversationOf(store), { at: new Date(), from: "participant", who: participant.name, text: answered, subject: subject.key }]);
        if (ready.recording) {
          try {
            await record(ready.page, ready.person, { at: new Date(), who: participant.name, page: subject.title, model: participant.model ?? undefined, text: answered,
              withheld: subject.withhold?.(answered) ?? undefined });
          } catch (failure) {
            status.append(problem(`The answer could not be recorded: ${said(failure)}`));
          }
        }
        // The hand-over the answer proposes goes on now, within the same Send: Stop ends it as it ends the message.
        if (result.draft?.handOver) await handOn(result.draft.handOver, participant, subject, conversationOf(store), controller.signal);
      }
    } catch (failure) {
      show(controller.signal.aborted || failure?.name === "Cancelled" ? problem("Stopped. Nothing was written.") : problem(said(failure)));
    } finally {
      state.controller = null;
      running = null;
      refreshStop();
      send.disabled = false;
    }
  }

  // *Spawn job*: the message is the task of a job that is the endpoint's own, spawned on GitHub Actions (UC-049 4a) — one click, the person's. The task travels in the
  // workflow's inputs and is written to no file; with recording on, the message is recorded first, as a sent message is. The bar then follows the job until it has
  // ended and shows the answer its run left (follow.mjs).
  async function onSpawn(participant, instruction) {
    if (state.spawning || state.stopped) return;
    state.spawning = true;
    send.disabled = true;
    show(el("p", "spawning", `Spawning a job for ${participant.name} — ${placeOf(participant)} on GitHub Actions…`));
    try {
      const subject = setup.subject();
      const page = pageOf();
      const instanceSnapshot = await defaultSnapshot(instance.host);
      const recordingOn = await recordingOf(instanceSnapshot);
      showRecording(recordingOn);
      let source;
      try { source = subject.paramsFor(participant).source; } catch (failure) { show(problem(`Nothing was spawned. ${said(failure)}`)); return; }
      const who = personOf(store, instanceSnapshot, false) ?? "person";
      if (recordingOn) await record(page, who, { at: new Date(), who, page: subject.title, text: instruction, withheld: subject.withhold?.(instruction) ?? undefined });
      const conversationPath = recordingOn ? (readTabValue(store, RECORDS) ?? {})[page.address]?.path ?? null : null;
      const spawned = await spawnEndpointJob({ kind: BAR_KIND, task: instruction, participant, store, instance, page, ofProduct: setup.product() !== null,
        conversation: conversationPath, source, instanceSnapshot });
      if (spawned.refused) {
        const parts = [problem(`Nothing was spawned: ${spawned.refused}.`)];
        if (spawned.needsWorkflow) {
          const set = button("settings-link", "Set up the job workflow");
          set.addEventListener("click", () => setup.go("settings"));
          parts.push(set);
        }
        show(...parts);
        return;
      }
      keep([...conversationOf(store), { at: new Date(), from: "person", who, text: instruction, subject: subject.key }]);
      input.value = "";
      state.spawnedBy = participant.name;
      show(el("p", "queued", `Spawned as ${spawned.id} on GitHub Actions.`));
      keepJob({ id: spawned.id, address: page.address });
      follow({ id: spawned.id, address: page.address });
    } catch (failure) {
      const findings = failure?.name === "NotStartable" && Array.isArray(failure.findings) ? failure.findings : [];
      show(problem(findings.length > 0 ? "Nothing was spawned." : `Nothing was spawned. ${said(failure)}`),
        ...(findings.length > 0 ? [el("ul", "reasons", ...findings.map((each) => el("li", "reason", shown(each))))] : []));
    } finally {
      state.spawning = false;
      send.disabled = false;
    }
  }

  // The label of the button for the one chosen now: *Spawn job* where it runs through GitHub Actions.
  const relabel = () => {
    const label = offered.length > 0 && throughActions(chosen(), store) ? SPAWN : SEND;
    if (send.textContent !== label) send.replaceChildren(label);
  };

  // The participants reached that can do the kind of the subject now (UC-019 2): `eligible` judges them against the `needs` of the kind's
  // definition. The subject is a getter, so the offer is drawn from it whenever the bar is used: when the bar is drawn, when its input or its
  // selector takes focus, and on *Send*. Where some are reached and none can, the bar says so, names what the kind needs and links the route
  // `participants` (UC-019 3a).
  async function judge() {
    const kind = await kindOf(BAR_KIND);
    if (state.stopped) return;
    offered = eligible(reached, { capabilities: kind.needs }).eligible;
    // The participant talked to is kept in the tab (Data: the conversation), so that a reload or the next page offers it first again.
    let kept = selector?.value;
    if (kept === undefined) {
      try { kept = readTabValue(store, CHOSEN) ?? undefined; } catch { /* the tab keeps no values */ }
    }
    if (offered.length === 0) {
      selector = null;
      offeredNames = null;
      const link = button("participants-link", "Set up participants");
      link.addEventListener("click", () => setup.go("participants"));
      chooser.replaceChildren(el("p", "none-able", `No participant of this instance can do ${kind.name}: it needs ${kind.needs.join(", ")}.`), link);
      return;
    }
    const named = (each) => `${each.name} — ${placeOf(each)}`;
    // The same offer keeps its selector: replacing it while it takes focus would close its list before a choice is made.
    const names = offered.map((each) => each.name).join("\n");
    if (selector && names === offeredNames) return relabel();
    offeredNames = names;
    if (offered.length === 1) {
      selector = el("span", "participant", named(offered[0]));
    } else {
      selector = el("select", "participant");
      for (const each of offered) {
        const option = el("option", null, named(each));
        option.value = each.name;
        selector.append(option);
      }
      selector.value = offered.some((each) => each.name === kept) ? kept : offered[0].name;
      selector.addEventListener("focus", () => judge().catch(() => {}));
      selector.addEventListener("change", (event) => {
        try { writeTabValue(store, CHOSEN, event.target.value); } catch { /* the tab keeps no values */ }
        relabel();
      });
    }
    chooser.replaceChildren(selector);
    relabel();
  }

  // The participant a message goes to: the offer is judged again for the subject now, then the chosen one is taken; null where none can.
  async function rejudged() {
    await judge();
    return offered.length === 0 ? null : chosen();
  }

  async function draw() {
    // The instance's default branch as the page's own load read it, where the page hands it (setup.instanceSnapshot), else read here.
    const snapshot = (await setup.instanceSnapshot?.()) ?? await defaultSnapshot(instance.host);
    instanceWeb = snapshot.repository.web;
    // This browser's endpoints first (UC-049 1); then the participants of the instance's list this browser reaches, other than an endpoint offered already.
    const own = endpointsOffered(store);
    const ownNames = new Set(own.map((each) => each.name));
    reached = [...own, ...offeredAmong(await readParticipants(snapshot), store)
      .filter((each) => !ownNames.has(each.name) && !ownNames.has(/^endpoint\s+(\S+)/.exec(each.route ?? "")?.[1]))];
    if (reached.length === 0 || state.stopped) return;
    await judge();
    if (state.stopped) return;
    input.addEventListener("focus", () => judge().catch(() => {}));
    showRecording(await recordingOf(snapshot));
    send.addEventListener("click", onSend);
    // Clear conversation empties the tab's conversation and what the bar shows of the last message; while a message runs it does nothing — Stop ends that first.
    clear.addEventListener("click", () => {
      if (send.disabled) return;
      keep([]);
      status.replaceChildren();
    });
    stop.addEventListener("click", () => (state.controller ? state.controller.abort() : state.follower?.cancel()));
    conversation.replaceChildren(...conversationOf(store).map(line));
    // Below the message field: on the left the folded explanation, on the right the buttons.
    const notes = el("div", "bar-notes", clear, " ", setup.explain("prompt-bar"));
    // The grip on the bar's top edge: dragged, or moved with the arrow keys, it sets how much of the window the bar takes; the tab keeps it (Data: the conversation).
    const grip = el("div", "bar-grip");
    grip.setAttribute("role", "separator");
    grip.setAttribute("aria-orientation", "horizontal");
    grip.setAttribute("aria-label", "Drag up or down, or use the arrow keys, to set the height of the prompt bar");
    grip.setAttribute("tabindex", "0");
    const bar = el("section", "prompt-bar", grip, recorded, chooser, conversation, input, el("div", "bar-foot", notes, el("div", "buttons", send, stop)), status, followed);
    bar.setAttribute("data-page", setup.page);
    // "fixed to the bottom of the window" (Interfaces: startPromptBar): the bar's own root element carries the style, as Parts name no style sheet.
    bar.setAttribute("style", FIXED);
    const sized = (height) => {
      const highest = Math.round((globalThis.innerHeight ?? 800) * 0.9);
      const kept = Math.max(LOWEST, Math.min(highest, Math.round(height)));
      bar.setAttribute("style", `${FIXED} height: ${kept}px; max-height: ${kept}px;`);
      grip.setAttribute("aria-valuenow", String(kept));
      try { writeTabValue(store, HEIGHT, kept); } catch { /* the tab keeps no values */ }
      return kept;
    };
    let held = null;
    try { held = readTabValue(store, HEIGHT); } catch { /* the tab keeps no values */ }
    if (typeof held === "number") sized(held);
    const current = () => bar.offsetHeight || held || LOWEST;
    grip.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault?.();
      held = sized(current() + (event.key === "ArrowUp" ? STEP : -STEP));
    });
    grip.addEventListener("pointerdown", (event) => {
      event.preventDefault?.();
      grip.setPointerCapture?.(event.pointerId);
      const move = (moved) => { held = sized((globalThis.innerHeight ?? 800) - moved.clientY); };
      const end = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", end); grip.removeEventListener("pointercancel", end); };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", end);
      grip.addEventListener("pointercancel", end);
    });
    target.replaceChildren(bar);
    // A job handed over on an earlier page of this tab goes on being followed.
    let handedOver = null;
    try {
      handedOver = readTabValue(store, JOB);
    } catch { /* the tab keeps no values */ }
    if (handedOver !== null && handedOver.address === pageOf().address) follow(handedOver);
  }

  draw().catch((failure) => {
    if (!state.stopped) target.replaceChildren(problem(`The prompt bar could not read the participants. ${said(failure)}`));
  });

  return {
    stop() {
      state.stopped = true;
      state.controller?.abort();
      state.follower?.stop();
      target.replaceChildren();
    },
  };
}
