// MOD-prompt-bar — the prompt bar, where a person talks to an agent about the page (docs/architecture/MOD-prompt-bar.md): its
// interface. Of it, ITM-503 builds the recording switch and the conversation record (record.mjs): recordingSchema and recordingOf.
// ITM-504 builds the bar (bar.mjs): startPromptBar, latestDraft and currentJob, with the participants it offers (offer.mjs) and a
// message sent as a job in this tab (send.mjs). ITM-505 builds the hand-over a participant proposes in the bar: its route
// (hand-over.mjs), queued as the participant's own job (UC-049 4a.2) and followed until it has ended, with *Stop* cancelling it (follow.mjs).
// ITM-572 adds the strategy sets a hand-over is prepared with (hand-over.mjs), which the frame registers through loadHandOverStrategies.
//
// Module: MOD-prompt-bar
//
// It belongs to the Site (ARC-038) and runs in a browser. Every other file of this folder is private to the module.

export { currentJob, dropDraft, followJob, latestDraft, startPromptBar } from "./bar.mjs";
export { recordingOf, recordingSchema } from "./record.mjs";
export { endpointLacks, endpointsOffered } from "./offer.mjs";

// The hand-over's strategy sets and spawnEndpointJob, imported when first asked for: a page that draws the bar loads none of their modules.
export const loadHandOverStrategies = async () => (await import("./hand-over.mjs")).handOverStrategies;
export const spawnEndpointJob = async (options) => (await import("./hand-over.mjs")).spawnEndpointJob(options);
