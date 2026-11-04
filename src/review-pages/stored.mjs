// The impact list and the last accepted text of a changed decision or module file, read from what MOD-trace-graph's publishGraph stored for the commit the page shows
// (ITM-942). One responsibility: finding the stored entry that fits a file, and taking both from it; where no entry fits, the caller derives both as before.
import { storedImpacts } from "../trace-graph/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { impactSection } from "./sections.mjs";

// The stored lists of the snapshot's commit, read once for a page, in one request; null where there are none.
export const storedOnce = (snapshot) => {
  let held = null;
  return () => (held ??= snapshot.commit ? storedImpacts(snapshot, snapshot.commit).catch(() => null) : Promise.resolve(null));
};

// { last: { text }, shown, impact } for a file whose entry's blob is the file's blob: the text at the entry's `before` commit, by one readFileAt, and the stored list drawn and as it is stored;
// null where no entry fits, where the file was never accepted, or where that text cannot be read.
export async function fromStored(file, snapshot, host, storedOf) {
  const entry = (await storedOf())?.get(file.path);
  if (!entry || entry.before === null || entry.blob !== snapshot.blob(file.path)) return null;
  let text;
  try { text = (await host.readFileAt(file.path, [entry.before])).get(entry.before); } catch { return null; }
  if (typeof text !== "string") return null;
  const shown = impactSection(entry.impact, null);
  shown.append(explain("impact-of-a-change"));
  return { last: { text }, shown, impact: entry.impact };
}
