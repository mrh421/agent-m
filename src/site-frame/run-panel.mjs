// The run panel (MOD-site-frame, Parts: run-panel.mjs; Interfaces: runPanel): what a job will send where, before the person decides.
//
// Module: MOD-site-frame
//
// The panel shows a MOD-job-runner `Prepared` value and nothing else, as text: every destination with its participant, role, model and
// place and the parts sent there with their sizes and the sources they carry; what does not fit; the parts left out; the findings that
// keep the job from starting; the limit of correction rounds. Run is offered only when no finding blocks and nothing does not fit; a part
// left out keeps nothing from starting. A press of Run calls onRun once and disables the button; Cancel is there only with onCancel.
// A model, a place or a context that is null is said not to be declared.

const NOT_DECLARED = "not declared";

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function destinationOf(destination, parts) {
  const { participant } = destination;
  const box = make("section", "destination");
  const context = participant.context === null ? `context ${NOT_DECLARED}` : `of ${participant.context} tokens of context`;
  box.append(make("h3", "", `${participant.name} — ${destination.role}`),
    make("p", "", `model: ${participant.model ?? NOT_DECLARED}; processes data at: ${destination.place || NOT_DECLARED}`));
  const list = make("ul");
  for (const name of destination.parts) {
    const sent = parts.find((each) => each.name === name);
    const carries = sent.sources.length ? `, carries ${sent.sources.join(", ")}` : "";
    list.append(make("li", "part", `${name} — ${sent.size} tokens${carries}`));
  }
  box.append(list, make("p", "size", `${destination.size} tokens ${context}`));
  return box;
}

/**
 * runPanel(prepared: Prepared, handlers: { onRun: () -> Promise<void>, onCancel?: () -> void }) -> Element — the panel before a job
 * runs (THE PAGE STATES WHAT IT SENDS WHERE). Run is a button only while nothing blocks and everything fits; pressing it calls onRun once.
 */
export function runPanel(prepared, handlers) {
  const panel = make("section", "run-panel");
  for (const destination of prepared.destinations) panel.append(destinationOf(destination, prepared.parts));
  for (const { participant, size, context } of prepared.notFitting) {
    panel.append(make("p", "not-fitting", `${participant.name} cannot hold what it would receive: ${size} tokens, its context holds ${context ?? NOT_DECLARED}`));
  }
  const left = make("ul");
  for (const { part, reason } of prepared.leftOut) left.append(make("li", "left-out", `${part} left out: ${reason}`));
  const blocking = make("ul");
  for (const found of prepared.blocking) {
    blocking.append(make("li", "blocking", `${found.kind}: ${found.what} — ${found.fix} [${found.rule}]`));
  }
  panel.append(left, blocking, make("p", "limit", `Correction rounds: at most ${prepared.limit}`));

  if (prepared.blocking.length === 0 && prepared.notFitting.length === 0) {
    const run = make("button", "btn", "Run");
    run.addEventListener("click", (event) => {
      // Run starts a job: only a click the browser marks as a person's (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
      if (event?.isTrusted !== true || run.hasAttribute("disabled")) return;
      run.setAttribute("disabled", "");
      handlers.onRun();
    });
    panel.append(run);
  }
  if (handlers.onCancel) {
    const cancel = make("button", "btn", "Cancel");
    cancel.addEventListener("click", () => handlers.onCancel());
    panel.append(cancel);
  }
  return panel;
}
