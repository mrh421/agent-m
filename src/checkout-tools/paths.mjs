// Where a tool of a model endpoint may work: inside the job's checkout, every path resolved through its symbolic links (MOD-checkout-tools, Parts: paths.mjs).
//
// Module: MOD-checkout-tools

import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { withheld } from "../job-runner/index.mjs";

export const NO_CHECKOUT = "refused: this job works in no checkout";
const refusal = (why) => `refused: ${why}`;
const exists = (path) => { try { lstatSync(path); return true; } catch { return false; } };

// rootOf(context) -> string | null — the real path of the job's checkout, `context.product.checkout`; null for a job that works in none.
export function rootOf(context) {
  const checkout = context?.product?.checkout;
  return typeof checkout === "string" && checkout ? realpathSync(checkout) : null;
}

/**
 * inside(root, given) -> { path, relative } | { refused } — the real path of `given`, read against the checkout `root` and resolved through every symbolic
 * link; a path that does not exist yet is its nearest existing folder's real path with the rest appended. `relative` is the path within the checkout, with
 * "/" between its parts. Refused when the real path lies outside the checkout, or when a link on the way leads nowhere.
 */
export function inside(root, given) {
  const wanted = resolve(root, String(given ?? "."));
  const rest = [];
  let existing = wanted;
  while (!exists(existing)) {
    rest.unshift(basename(existing));
    const up = dirname(existing);
    if (up === existing) break;
    existing = up;
  }
  let real;
  try { real = join(realpathSync(existing), ...rest); } catch { return { refused: refusal(`${given} leads through a link to nothing, and cannot be placed inside the checkout ${root}`) }; }
  const within = relative(root, real);
  if (within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) return { refused: refusal(`${given} is outside the checkout ${root}`) };
  return { path: real, relative: within === "" ? "." : within.split(sep).join("/") };
}

// barred(context, relative) -> string | null — MOD-job-runner's refusal for a path whose content is a restricted source's the drafter's place is not allowed.
export const barred = (context, path) => (context?.places ? withheld(context, path) : null);
