// main.mjs — reads the entry's name from the command line and the environment, runs the entry, and ends with its status
// (MOD-workflow-entries, Parts). ITM-364 builds it with the instance's onApprovalsCommitted, ITM-365 adds the product's onRecordsChanged and onDispatch, ITM-1209 onTestsFinished, ITM-1210 onDoneCheck, ITM-1215 runTests, ITM-583 onPullRequestClosed; the other entries are other items'.
//
// Module: MOD-workflow-entries
//
// Every workflow file that runs an entry runs `node src/workflow-entries/main.mjs <entry>` from a checkout of the instance repository
// (Data). The command line prints the status's summary and its findings and ends with exit code 0 for `done` and `nothing to do`, else 1:
// a status of `failed` or `not run` is never shown as passed.

import { pathToFileURL } from "node:url";
import { ciEnvironment } from "./compose.mjs";
import { runAsModelUser, separates } from "./model-user.mjs";
import { onApprovalsCommitted, onSourcesCommitted, onReleaseTagged } from "./instance.mjs";
import { onMainChanged } from "./main-changed.mjs";
import { onRecordsChanged, onDispatch, onCheckCompleted, onSchedule, chooseAgentKey, leaveResult, writeResult, runTests, onTestsFinished, onDoneCheck, onPullRequestClosed } from "./product.mjs";

const ENTRIES = { onApprovalsCommitted, onSourcesCommitted, onMainChanged, onReleaseTagged, onRecordsChanged, onDispatch, onCheckCompleted, onSchedule,
  chooseAgentKey, leaveResult, writeResult, runTests, onTestsFinished, onDoneCheck, onPullRequestClosed };

/**
 * runEntry(name: string, env: Record<string, string | undefined>, options?: { now?: Date }) -> Promise<EntryStatus> — runs the entry of that
 * name in the environment a workflow gives it; where model-user.mjs' `separates` holds, as the model's user (runAsModelUser). An entry that does
 * not exist is `failed`. It never throws: a failure of the entry is the status.
 */
export async function runEntry(name, env, options = {}) {
  const entry = Object.hasOwn(ENTRIES, name) ? ENTRIES[name] : null;
  if (!entry) return { outcome: "failed", summary: `There is no entry ${name}.`, findings: [] };
  try {
    const ci = ciEnvironment(name, env, options.now ?? new Date());
    return await (separates(name, ci) ? runAsModelUser(name, env, ci, entry) : entry(ci));
  } catch (error) {
    return { outcome: "failed", summary: `${name} failed: ${error?.message ?? error}`, findings: [] };
  }
}

// The command line: the entry's name is the first argument.
async function main(argv, env) {
  const status = await runEntry(argv[2], env);
  console.log(`${argv[2]}: ${status.outcome} — ${status.summary}`);
  for (const found of status.findings) console.log(`${found.artifact}:${found.line}: ${found.kind}: ${found.what} [${found.rule}] — ${found.fix}`);
  process.exitCode = ["done", "nothing to do"].includes(status.outcome) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv, process.env);
