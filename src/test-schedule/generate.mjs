// The CI configuration generated from a schedule (MOD-test-schedule, Interfaces: ciConfiguration): a GitHub Actions
// workflow or a GitLab CI file with one job per ticked row and occasion, from the fixed parts in templates/. As the module's
// Data states under The generated configuration (ITM-1214): each test job runs as its row's shards — a matrix on GitHub,
// `parallel:` on GitLab — with the variables of a test job, restores the cache, runs `setup`, then runTests, and keeps its
// report and status; every job of a commit or a pull request carries `minutes`; agent-m setup fills the cache where `cache`
// names paths; agent-m records runs onTestsFinished after every test job and agent-m done onDoneCheck on a pull request, the
// two the only jobs that read the person's token.
//
// Module: MOD-test-schedule

import { participantsOf } from "../participant-list/index.mjs";
import { formatFinding } from "../text-tools/index.mjs";
import { scheduleFindings } from "./rules.mjs";
import { OCCASIONS, nightlyCron, nightlyRows, occasionsOf, rowsOf, secretsNeeded } from "./occasions.mjs";
import { ownText } from "./own-file.mjs";

const NAMES = ["github-head", "github-checkouts", "github-setup", "github-job", "github-records", "github-done",
  "gitlab-head", "gitlab-setup", "gitlab-job", "gitlab-records", "gitlab-done"];
const TEMPLATES = Object.fromEntries(await Promise.all(
  NAMES.map(async (name) => [name, await ownText(`templates/${name}.yml`)])));

const GITHUB_FILE = ".github/workflows/agent-m-tests.yml";
const GITLAB_FILE = ".gitlab/agent-m-tests.yml";
const INCLUDE_ENTRY = `- local: ${GITLAB_FILE}`;
// The occasion as a test job names it in AGENT_M_OCCASION (MOD-test-schedule, Data: The variables of a test job).
const OCCASION_VALUE = { "every commit": "commit", "pull request": "pull-request", nightly: "nightly", "release candidate": "release-candidate",
  "on demand": "on-demand" };
// The occasions whose jobs carry the schedule's `minutes` (MOD-test-schedule, Data: The generated configuration).
const BOUNDED = ["every commit", "pull request"];
// The file on a GitLab runner that holds the week whose setup the cache keeps.
const WEEK_FILE = ".agent-m-setup-week";

// What starts a job of each occasion, on GitHub (an `if:` expression) and on GitLab (a rule's `if` expression).
const GITHUB_IF = {
  "every commit": () => "github.event_name == 'push' && !startsWith(github.ref, 'refs/tags/')",
  "pull request": () => "github.event_name == 'pull_request'",
  nightly: () => "github.event_name == 'schedule'",
  "release candidate": () => "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')",
  "on demand": (row) => `github.event_name == 'workflow_dispatch' && contains(format(',{0},', inputs.rows), ',${row},')`,
};
const GITLAB_IF = {
  "every commit": () => '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_TAG == null',
  "pull request": () => '$CI_PIPELINE_SOURCE == "merge_request_event"',
  nightly: () => '$CI_PIPELINE_SOURCE == "schedule"',
  "release candidate": () => "$CI_COMMIT_TAG =~ /^v.*-rc\\..*$/",
  "on demand": (row) => (row ? `$CI_PIPELINE_SOURCE == "web" && $ROWS =~ /(^|,)${row}(,|$)/` : '$CI_PIPELINE_SOURCE == "web"'),
};
// A push that changes only job records or conversation records starts no GitLab commit job. GitLab's `rules:changes` takes
// globs of Ruby's File.fnmatch, which have no negation of a directory but do have `[!x]` and braces: the paths below are
// every path that does not lie under one of the ignored directories.
const IGNORED = ["docs/jobs", "docs/conversations"];

// The names that are not one of `names`, as brace alternatives: at each position a character other than those the names
// continue with, a proper prefix of a name, and a name continued by at least one more character.
function otherThan(names, prefix = "") {
  const next = [...new Set(names.filter((n) => n.length > prefix.length && n.startsWith(prefix)).map((n) => n[prefix.length]))];
  const alternatives = next.length ? [`${prefix}[!${next.join("")}]*`] : [];
  if (prefix && !names.includes(prefix)) alternatives.push(prefix);
  if (names.includes(prefix)) alternatives.push(`${prefix}?*`);
  for (const c of next) alternatives.push(...otherThan(names, prefix + c));
  return alternatives;
}
const braces = (names) => `{${otherThan(names).join(",")}}`;
const below = IGNORED.map((d) => d.split("/")).reduce((m, [top, sub]) => m.set(top, [...(m.get(top) ?? []), sub]), new Map());
const GITLAB_CHANGES = ["*", ...[...below].flatMap(([top, subs]) => [`${top}/*`, `${top}/${braces(subs)}/**/*`]),
  `${braces([...below.keys()])}/**/*`];

const quoted = (text) => `'${text.replaceAll("'", "''")}'`;
const lines = (indent, items) => items.map((item) => indent + item).join("\n");

// Fills the {{name}} marks of a template; a mark that stands alone on its line takes its value's lines, or leaves the line out.
function fill(template, values) {
  return template.replace(/^\{\{(\w+)\}\}(?:\n|$)|\{\{(\w+)\}\}/gm, (all, alone, inline) => {
    const value = values[alone ?? inline];
    if (alone) return value ? `${value}\n` : "";
    return value;
  });
}

// Where a row runs: the runner label of the participant its `runs on` names, or null for the server's own runners.
function runnerOf(cells, participants) {
  const named = cells["runs on"];
  if (!named || named === "hosted") return null;
  return /runner:(\S+)/.exec(participantsOf(participants).find((p) => p.name === named)?.route ?? "")?.[1] ?? null;
}

/**
 * ciConfiguration(schedule, target, resources, participants) -> { files, include, pipelineSchedule } — the configuration
 * generated from the schedule: on GitHub `.github/workflows/agent-m-tests.yml`; on GitLab `.gitlab/agent-m-tests.yml`, the
 * entry the product's `.gitlab-ci.yml` must include it by, and the pipeline schedule of the nightly run. Throws
 * `InvalidSchedule` (with `findings`) for a schedule with an error finding.
 */
export function ciConfiguration(schedule, target, resources, participants) {
  const findings = scheduleFindings(schedule, participants).filter((f) => f.kind === "error");
  if (findings.length) {
    throw Object.assign(new Error(`InvalidSchedule: ${findings.map(formatFinding).join("; ")}`),
      { name: "InvalidSchedule", findings });
  }
  const fm = schedule.fields;
  const secrets = secretsNeeded(schedule, resources).map((s) => s.name);
  // One test job for each row and occasion the schedule ticks, in the order of the table and of the occasions.
  const tests = rowsOf(schedule).flatMap(({ cells }) => occasionsOf(cells.Row, schedule).map((occasion) => ({
    row: cells.Row, occasion, key: `${cells.Row}-${occasion.replaceAll(" ", "-")}`, shards: cells.shards ?? 1,
    runner: runnerOf(cells, participants), secrets: cells.Row === "paid" ? secrets : [],
  })));
  const parts = {
    tests, setup: fm.setup || "", cache: fm.cache ?? [], minutes: fm.minutes ?? null, command: quoted(fm.command || ""),
    commit: target.instanceCommit,
    // The rows a pull request runs, with their numbers of shards, as agent-m done expects them.
    expected: quoted(tests.filter((t) => t.occasion === "pull request").map((t) => `${t.row}:${t.shards}`).join(",")),
  };
  const nightly = nightlyRows(schedule);
  if (target.server === "github") {
    const head = fill(TEMPLATES["github-head"], {
      nightly: nightly.length ? `  schedule:\n    - cron: "${nightlyCron(schedule)}"` : "",
    });
    return { files: { [GITHUB_FILE]: head + githubJobs(parts, target).join("") }, include: null, pipelineSchedule: null };
  }
  return {
    files: { [GITLAB_FILE]: TEMPLATES["gitlab-head"] + gitlabJobs(parts, target).join("\n") },
    include: { file: ".gitlab-ci.yml", entry: INCLUDE_ENTRY },
    pipelineSchedule: nightly.length ? { cron: nightlyCron(schedule), rows: nightly } : null,
  };
}

// A short name of a text that changes with it — FNV-1a's 32 bits in hexadecimal —, so that another setup gives another cache key.
function digest(text) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
const indented = (indent, text) => text.split("\n").map((line) => indent + line).join("\n");
const cached = (parts) => parts.cache.length > 0;

// The jobs of the GitHub workflow: agent-m setup where the cache names paths, the test jobs, agent-m records and agent-m done.
function githubJobs(parts, target) {
  const limit = (bounded) => (parts.minutes && bounded ? `    timeout-minutes: ${parts.minutes}` : "");
  const commit = quoted(parts.commit);
  const checkouts = fill(TEMPLATES["github-checkouts"], { instance: target.instance, commit: parts.commit }).replace(/\n$/, "");
  const paths = indented("            ", parts.cache.join("\n"));
  const setupJob = cached(parts) ? fill(TEMPLATES["github-setup"], {
    timeout: limit(true), hash: digest(parts.setup), paths, setup: parts.setup ? indented("          ", parts.setup) : "          true",
  }) : "";
  const restore = cached(parts) ? ["      - uses: actions/cache/restore@v4", "        with:", "          path: |", paths,
    "          key: ${{ needs.agent-m-setup.outputs.key }}"].join("\n") : "";
  const setupStep = parts.setup ? ["      - name: Set up the tests", "        run: |", indented("          ", parts.setup)].join("\n") : "";
  const jobs = parts.tests.map((t) => fill(TEMPLATES["github-job"], {
    key: t.key, row: t.row, occasion: OCCASION_VALUE[t.occasion], condition: GITHUB_IF[t.occasion](t.row),
    needs: cached(parts) ? "    needs: agent-m-setup" : "", runsOn: t.runner ? `[self-hosted, ${t.runner}]` : "ubuntu-latest",
    timeout: limit(BOUNDED.includes(t.occasion)), shards: Array.from({ length: t.shards }, (_, i) => i + 1).join(", "),
    count: quoted(String(t.shards)), command: parts.command, secretNames: quoted(t.secrets.join(",")), commit,
    secrets: lines("      ", t.secrets.map((n) => `${n}: \${{ secrets.${n} }}`)), checkouts, restore, setup: setupStep,
  }));
  const records = fill(TEMPLATES["github-records"], {
    needs: parts.tests.map((t) => t.key).join(", "), timeout: limit(true), commit, checkouts,
  });
  const done = fill(TEMPLATES["github-done"], {
    needs: [...parts.tests.filter((t) => t.occasion === "pull request").map((t) => t.key), "agent-m-records"].join(", "),
    timeout: limit(true), expected: parts.expected, commit, checkouts,
  });
  return [setupJob, ...jobs, records, done].filter(Boolean);
}

// The jobs of the GitLab file: agent-m setup where the cache names paths, the test jobs, agent-m records and agent-m done.
function gitlabJobs(parts, target) {
  const limit = (bounded) => (parts.minutes && bounded ? `  timeout: ${parts.minutes} minutes` : "");
  const commit = quoted(parts.commit);
  const clone = quoted(`git clone ${target.instance} .agent-m && git -C .agent-m checkout ${parts.commit}`);
  const changes = `      changes:\n${lines("        ", GITLAB_CHANGES.map((c) => `- "${c}"`))}`;
  const key = `agent-m-setup-${digest(parts.setup)}`;
  const cache = (policy) => (cached(parts) ? ["  cache:", `    key: ${key}`, "    paths:", lines("      - ", [...parts.cache, WEEK_FILE]),
    ...(policy ? [`    policy: ${policy}`] : [])].join("\n") : "");
  // The rules of a job that serves every occasion the schedule ticks: one for each, a push of only job records left out as for the commit rows.
  const used = OCCASIONS.filter((o) => parts.tests.some((t) => t.occasion === o));
  const rules = (always) => used.map((o) => [`    - if: ${quoted(GITLAB_IF[o](null))}`, ...(o === "every commit" ? [changes] : []),
    ...(always ? ["      when: always"] : [])].join("\n")).join("\n");
  const setupJob = cached(parts) ? fill(TEMPLATES["gitlab-setup"], { timeout: limit(true), setup: quoted(parts.setup), rules: rules(false), cache: cache(null) }) : "";
  const jobs = parts.tests.map((t) => fill(TEMPLATES["gitlab-job"], {
    key: t.key, row: t.row, occasion: OCCASION_VALUE[t.occasion], tags: t.runner ? `  tags: [${t.runner}]` : "",
    parallel: t.shards > 1 ? `  parallel: ${t.shards}` : "", timeout: limit(BOUNDED.includes(t.occasion)),
    shard: t.shards > 1 ? "$CI_NODE_INDEX" : quoted("1"), count: quoted(String(t.shards)), command: parts.command,
    secretNames: quoted(t.secrets.join(",")), commit, rule: quoted(GITLAB_IF[t.occasion](t.row)),
    changes: t.occasion === "every commit" ? changes : "",
    secrets: t.secrets.length ? `  # Secrets, read from the CI variables: ${t.secrets.join(", ")}` : "",
    cache: cache("pull"), clone, setup: parts.setup ? `    - ${quoted(parts.setup)}` : "",
  }));
  const records = fill(TEMPLATES["gitlab-records"], { timeout: limit(true), commit, rules: rules(true), clone });
  const done = fill(TEMPLATES["gitlab-done"], { timeout: limit(true), expected: parts.expected, commit, clone });
  return [setupJob, ...jobs, records, done].filter(Boolean);
}

// ---------------------------------------------------------------------------------------- the comparison with a committed one

// The runs of committed lines that differ from the generated lines, as { at, found, expected }: `at` is the 0-based line of the
// committed text where the run begins, `found` its lines there and `expected` the generated lines that stand in their place — either
// may be empty, for a line that is missing or one that is added. A line left out or put in changes the runs at its own place only.
function hunks(committed, generated) {
  let start = 0;
  while (start < committed.length && start < generated.length && committed[start] === generated[start]) start += 1;
  let endCommitted = committed.length;
  let endGenerated = generated.length;
  while (endCommitted > start && endGenerated > start && committed[endCommitted - 1] === generated[endGenerated - 1]) {
    endCommitted -= 1;
    endGenerated -= 1;
  }
  const a = committed.slice(start, endCommitted);
  const b = generated.slice(start, endGenerated);
  // table[i][j]: the length of the longest common run of lines of a[i..] and b[j..].
  const table = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const runs = [];
  let current = null;
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      current = null;
      i += 1;
      j += 1;
      continue;
    }
    if (!current) runs.push(current = { at: start + i, found: [], expected: [] });
    if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) current.found.push(a[i++]);
    else current.expected.push(b[j++]);
  }
  return runs;
}

const shown = (lines) => (lines.length ? `\`${lines.map((line) => line.trim()).join(" | ")}\`` : "nothing");

// The include entry as a line of the product's `.gitlab-ci.yml` may write it: with or without quotes, and with a comment.
const plainEntry = (line) => line.trim().replace(/\s+#.*$/, "").replace(/["']/g, "");

// What a workflow's `on:` names, as far as its text shows: `on: push`, `on: [push, pull_request]`, `on: { push: ... }`, or the
// block whose keys (or list items) stand one level below `on:`.
function triggersOf(text) {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => /^["']?on["']?\s*:/.test(line));
  if (at < 0) return [];
  const inline = lines[at].replace(/^["']?on["']?\s*:\s*/, "").replace(/\s+#.*$/, "").trim();
  if (inline) {
    let flat = inline.replace(/^[[{]|[\]}]$/g, "");
    for (let before = ""; before !== flat;) {
      before = flat;
      flat = flat.replace(/[[{][^[\]{}]*[\]}]/g, "");
    }
    return flat.split(",").map((item) => /^[\w-]+/.exec(item.trim())?.[0]).filter(Boolean);
  }
  const body = [];
  for (const line of lines.slice(at + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    if (!/^\s/.test(line)) break;
    body.push(line);
  }
  const indent = (line) => line.length - line.trimStart().length;
  const base = Math.min(...body.map(indent));
  return body.filter((line) => indent(line) === base).map((line) => /^\s*(?:-\s+)?([\w-]+)/.exec(line)?.[1]).filter(Boolean);
}

// The occasion each event of a workflow, and each pipeline source of a GitLab file, stands for.
const EVENT_OCCASION = { push: "every commit", pull_request: "pull request", pull_request_target: "pull request", schedule: "nightly", workflow_dispatch: "on demand",
  merge_request_event: "pull request", web: "on demand" };

// The pipeline source each keyword of a GitLab job's `only` and `except` stands for; a ref name or `branches` or `tags` is a push.
const GITLAB_KEYWORD = { pushes: "push", merge_requests: "merge_request_event", schedules: "schedule", web: "web", api: "api", triggers: "trigger",
  pipelines: "pipeline", chat: "chat", external: "external", external_pull_requests: "external_pull_request_event" };
// The top-level keys of a `.gitlab-ci.yml` that are no job.
const GITLAB_GLOBAL = new Set(["stages", "include", "variables", "default", "workflow", "image", "services", "cache", "before_script", "after_script", "spec"]);

const indentOf = (line) => line.length - line.trimStart().length;
const quiet = (line) => /^\s*(#.*)?$/.test(line);

// The top-level keys of a YAML text that carry a block, each with the lines of its block.
function blocksOf(text) {
  const blocks = new Map();
  let body = null;
  for (const line of text.split("\n")) {
    if (quiet(line)) continue;
    if (/^\s/.test(line)) {
      body?.push(line);
      continue;
    }
    const key = /^([^\s:#"'-][^:]*?)\s*:\s*(?:#.*)?$/.exec(line)?.[1];
    body = key ? [] : null;
    if (key) blocks.set(key, body);
  }
  return blocks;
}

// The key `name` that stands at the first level of a block, as { inline, lines }: what follows it on its line, and the lines below it.
function childOf(body, name) {
  const base = Math.min(...body.map(indentOf));
  const at = body.findIndex((line) => indentOf(line) === base && new RegExp(`^${name}\\s*:`).test(line.trim()));
  if (at < 0) return null;
  const below = [];
  for (const line of body.slice(at + 1)) {
    if (indentOf(line) <= base) break;
    below.push(line);
  }
  return { inline: body[at].trim().replace(new RegExp(`^${name}\\s*:\\s*`), "").replace(/\s+#.*$/, ""), lines: below };
}

// The items of a list, each as its own text: the lines below a `-` at the list's first level, up to the next such `-`.
function itemsOf(lines) {
  const base = Math.min(...lines.map(indentOf));
  const items = [];
  for (const line of lines) {
    if (indentOf(line) === base && line.trim().startsWith("-")) items.push(line);
    else if (items.length) items[items.length - 1] += `\n${line}`;
  }
  return items;
}

// The pipeline sources a condition names: `$CI_PIPELINE_SOURCE == "push"`, or `=~ /^(push|schedule)$/`, joined by `||` or not.
function sourcesIn(text) {
  const named = [];
  for (const [, quoted, single, pattern] of text.matchAll(/\$CI_PIPELINE_SOURCE\s*(?:==|=~)\s*(?:"([^"]*)"|'([^']*)'|\/([^/]*)\/)/g)) {
    named.push(...(quoted ?? single ?? pattern).match(/[a-z_]+/g));
  }
  return named;
}

// What `rules` say: the sources of the rules that run the job, whether one of them names none, and the sources a rule excludes with `when: never`.
function rulesOf(rules) {
  const reading = { named: [], unnamed: false, denied: [] };
  for (const item of itemsOf(rules?.lines ?? [])) {
    const named = sourcesIn(item);
    if (/\bwhen:\s*["']?never\b/.test(item)) reading.denied.push(...named);
    else if (named.length) reading.named.push(...named);
    else reading.unnamed = true;
  }
  return reading;
}

// The words of a job's `only` or `except`: an inline list or word, a list, or the list below `refs:`.
function wordsOf(key) {
  if (!key) return null;
  const words = [...key.inline.matchAll(/[\w*/.^$()|-]+/g)].map((m) => m[0]);
  let listed = true;
  for (const line of key.lines) {
    const text = line.trim();
    if (text.startsWith("-")) {
      if (listed) words.push(text.replace(/^-\s*/, "").replace(/\s+#.*$/, "").replace(/^["']|["']$/g, ""));
    } else listed = /^refs\s*:/.test(text);
  }
  return words;
}
const sourceOfWord = (word) => GITLAB_KEYWORD[word] ?? "push";

// The pipeline sources that start the jobs of a `.gitlab-ci.yml`, in the order the file names them, or null where it holds no job.
function gitlabTriggersOf(text) {
  const blocks = blocksOf(text);
  const workflow = rulesOf(blocks.has("workflow") && blocks.get("workflow").length ? childOf(blocks.get("workflow"), "rules") : null);
  const allowed = workflow.named.length && !workflow.unnamed ? workflow.named : null;
  const jobs = [...blocks].filter(([key, body]) => body.length && !GITLAB_GLOBAL.has(key) && !key.startsWith("."));
  if (!jobs.length) return null;
  const triggers = [];
  for (const [, body] of jobs) {
    const rules = childOf(body, "rules");
    const only = wordsOf(childOf(body, "only"));
    const except = (wordsOf(childOf(body, "except")) ?? []).filter((word) => word in GITLAB_KEYWORD).map(sourceOfWord);
    let own = allowed ?? ["push"];
    if (rules) {
      const { named, unnamed } = rulesOf(rules);
      own = [...named, ...(unnamed ? ["push"] : [])];
    } else if (only) own = only.map(sourceOfWord);
    for (const source of own) {
      if (!workflow.denied.includes(source) && !except.includes(source) && (!allowed || allowed.includes(source))) triggers.push(source);
    }
  }
  return triggers;
}

// What is said of a configuration Agent M did not generate: its triggers, and the rows the schedule ticks for the occasions they stand for.
function foreignReading(triggerNames, schedule) {
  const triggers = [...new Set(triggerNames)];
  const occasions = [...new Set(triggers.flatMap((trigger) => EVENT_OCCASION[trigger] ?? []))];
  const rows = rowsOf(schedule).map(({ cells }) => cells.Row).filter((row) => occasions.some((o) => occasionsOf(row, schedule).includes(o)));
  return `not generated by Agent M; triggers: ${triggers.join(", ") || "none that could be read"}; the schedule runs`
    + ` ${rows.join(", ") || "no row"} on the occasions they stand for (${occasions.join(", ") || "none"})`;
}

/**
 * configurationDrift(files, schedule, target, resources, participants) -> Array<{ path, difference }> — where the committed
 * configuration differs from the one `ciConfiguration` generates from the same schedule, target, resources and participants: for
 * each generated file, each run of lines that differs (or the file, where it is missing), with the number of its first line and
 * the lines found and generated; on GitLab also the product's `.gitlab-ci.yml` where it lacks the include entry, with the triggers of its jobs and the rows they run; and, for each
 * GitHub workflow Agent M did not generate, its triggers and the rows they run. Empty where the configuration agrees. Throws
 * `InvalidSchedule`, as `ciConfiguration` does. Nothing of the committed files is used to generate the text they are compared with.
 */
export function configurationDrift(files, schedule, target, resources, participants) {
  const generated = ciConfiguration(schedule, target, resources, participants);
  const found = [];
  for (const [path, text] of Object.entries(generated.files)) {
    if (files[path] === undefined) {
      found.push({ path, difference: "the file is missing; the schedule generates it" });
      continue;
    }
    for (const run of hunks(files[path].split("\n"), text.split("\n"))) {
      found.push({ path, difference: `line ${run.at + 1}: found ${shown(run.found)}; the schedule generates ${shown(run.expected)}` });
    }
  }
  if (generated.include) {
    const { file, entry } = generated.include;
    if (files[file] === undefined) found.push({ path: file, difference: `the file is missing; it must include ${entry}` });
    else if (!files[file].split("\n").some((line) => plainEntry(line) === plainEntry(entry))) {
      // Agent M's file is then added beside the product's own configuration (UC-027 1a), whose triggers are read besides the missing entry.
      const triggers = gitlabTriggersOf(files[file]);
      found.push({ path: file, difference: `no line holds the include entry ${entry}${triggers ? `; ${foreignReading(triggers, schedule)}` : ""}` });
    }
  }
  if (target.server === "github") {
    for (const path of Object.keys(files)) {
      if (/^\.github\/workflows\/(?!agent-m-)[^/]+\.ya?ml$/.test(path)) found.push({ path, difference: foreignReading(triggersOf(files[path]), schedule) });
    }
  }
  return found;
}
