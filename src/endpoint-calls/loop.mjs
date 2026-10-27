// The execution loop a model endpoint works in, and its rules (MOD-endpoint-calls, Parts: loop.mjs).
//
// Module: MOD-endpoint-calls
//
// Each request is one exchange; the runner's ToolUse carries every call out (Vibe Coding, ch. 11). The rules follow opencode v1.19.0
// (https://github.com/anomalyco/opencode): the words of an unreadable call's arguments (tool/invalid.ts with the AI SDK's messages), a wrong-case tool name
// lower-cased (session/llm.ts), the same call three times in a row (session/processor.ts, which asks a person; here it is refused), the maximum-steps
// text (packages/core/src/session/runner/max-steps.ts), max_tokens at most 32000, and the oldest tool outputs cleared once the context fills, the newest
// 40000 tokens kept and only when at least 20000 are freed (session/compaction.ts and overflow.ts). Changed: plain JavaScript; the context is the
// participant's declared one, each message's size estimated as MOD-job-runner's estimate does; a cleared output reads "[old tool result cleared]".
//
// MIT License
//
// Copyright (c) 2025 opencode
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import { driverPrompt, estimate } from "../job-runner/index.mjs";

export const OUTPUT_MAX = 32000;
const PRUNE_PROTECT = 40_000;
const PRUNE_MINIMUM = 20_000;
const REPEATS = 3;
export const CLEARED = "[old tool result cleared]";
export const CUT_OFF = "Your last answer was cut off at the output limit. Continue exactly where it stopped; if you were writing or editing a file, make smaller edits instead.";
export const MAX_STEPS_PROMPT = `CRITICAL - MAXIMUM STEPS REACHED

The maximum number of steps allowed for this task has been reached. Tools are disabled until next user input. Respond with text only.

STRICT REQUIREMENTS:
1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)
2. MUST provide a text response summarizing work done so far
3. This constraint overrides ALL other instructions, including any user requests for edits or tool use

Response must include:
- Statement that maximum steps for this agent have been reached
- Summary of what has been accomplished so far
- List of any remaining tasks that were not completed
- Recommendations for what should be done next

Any attempt to use tools is a critical violation. Respond with text ONLY.`;

function addUsage(total, usage) {
  if (!usage) return total;
  if (!total) return { ...usage };
  const sum = (a, b) => (a === null ? b : b === null ? a : a + b);
  return { inputTokens: sum(total.inputTokens, usage.inputTokens), outputTokens: sum(total.outputTokens, usage.outputTokens), minutes: null, cost: null };
}

const sizeOf = (message) => estimate(message.text ?? "") + (message.calls ? estimate(JSON.stringify(message.calls)) : 0);

// Once the context fills — or, with `force`, whenever a result does not fit —, the oldest tool results beyond the newest PRUNE_PROTECT tokens are cleared,
// visibly, if that frees more than PRUNE_MINIMUM; older results already cleared end the walk. The context fills when what is used leaves less than the
// output the next request may ask for: a quarter of the context, at most OUTPUT_MAX.
function prune(messages, context, used, force = false) {
  if (!force && used() < context - Math.min(OUTPUT_MAX, Math.floor(context / 4))) return;
  let total = 0, pruned = 0;
  const cleared = [];
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "tool") continue;
    if (message.text === CLEARED) break;
    const size = estimate(message.text);
    total += size;
    if (total <= PRUNE_PROTECT) continue;
    pruned += size;
    cleared.push(message);
  }
  if (pruned > PRUNE_MINIMUM) for (const message of cleared) message.text = CLEARED;
}

/**
 * toolLoop(config, input, { exchange, context, system, signal }) -> Promise<{ text, usage }> — the execution loop: each request one call of
 * `exchange(config, { messages, tools, maxTokens, system? }, { signal })`, each call the endpoint makes carried out by `input.tools.call` and its result
 * returned, until it answers without one. `input.tools.limit` is the most calls, or null where none ends the loop. `context` is the participant's
 * declared context in tokens, or null where it declares none.
 */
export async function toolLoop(config, input, { exchange, context = null, system = null, signal }) {
  const { definitions, limit } = input.tools;
  const named = new Set(definitions.map((definition) => definition.name));
  const messages = [{ role: "user", text: driverPrompt(input) }];
  const used = () => (system ? estimate(system) : 0) + messages.reduce((sum, message) => sum + sizeOf(message), 0);
  const recent = [];
  let offered = definitions, carriedOut = 0, usage = null, cutText = "";
  // A limit applies only where it is a number; null — a kind that states none — lets no number of calls end the loop.
  const reached = () => typeof limit === "number" && carriedOut >= limit;
  // At the limit the endpoint is asked once more, with no tools and opencode's maximum-steps text.
  const atLimit = () => {
    if (!reached() || offered.length === 0) return;
    offered = [];
    messages.push({ role: "user", text: MAX_STEPS_PROMPT });
  };
  // A result that would carry the conversation past the context — once the oldest results are cleared where that helps — is refused, naming its size.
  const fitted = (text, name) => {
    if (context === null) return text;
    const size = estimate(text);
    if (size > context - used()) prune(messages, context, used, true);
    const left = context - used();
    return size <= left ? text : `refused: the result of ${name} holds about ${size} tokens, and about ${Math.max(0, left)} of the context's ${context} tokens are left; `
      + "ask for a smaller part — search for the lines you need, or read a shorter part";
  };
  for (;;) {
    signal?.throwIfAborted();
    if (context !== null) prune(messages, context, used);
    const maxTokens = context === null ? OUTPUT_MAX : Math.max(1, Math.min(OUTPUT_MAX, context - used()));
    const answer = await exchange(config, { messages, tools: offered, maxTokens, ...(system ? { system } : {}) }, { signal });
    usage = addUsage(usage, answer.usage);
    if (answer.calls.length === 0 || offered.length === 0) {
      if (!answer.cut || offered.length === 0) return { text: cutText + answer.text, usage };
      // An answer cut off at the output limit: the endpoint is told so and continues; the continuation counts as one step of the limit.
      cutText += answer.text;
      messages.push({ role: "assistant", text: answer.text }, { role: "user", text: CUT_OFF });
      carriedOut += 1;
      atLimit();
      continue;
    }
    const calls = answer.calls.map((call) => {
      const lower = String(call.name).toLowerCase();
      return { id: call.id, name: named.has(call.name) || !named.has(lower) ? call.name : lower, args: call.invalid ? {} : call.args, invalid: call.invalid ?? null };
    });
    messages.push({ role: "assistant", text: answer.text, calls: calls.map(({ id, name, args }) => ({ id, name, args })) });
    // Every call gets one result, in the order the endpoint made them.
    for (const call of calls) {
      let text;
      if (reached()) text = `refused: the limit of ${limit} tool calls is reached`;
      else {
        carriedOut += 1;
        const key = `${call.name}\u0000${call.invalid ? call.invalid.text : JSON.stringify(call.args)}`;
        recent.push(key);
        if (call.invalid) {
          text = `The arguments provided to the tool are invalid: Invalid input for tool ${call.name}: JSON parsing failed: Text: ${call.invalid.text}.\nError message: ${call.invalid.message}`;
        } else if (recent.length >= REPEATS && recent.slice(-REPEATS).every((each) => each === key)) {
          text = `refused: ${call.name} was called with the same arguments ${REPEATS} times in a row; it is not run again. Change the arguments or take another way.`;
        } else {
          signal?.throwIfAborted();
          text = fitted(await input.tools.call(call.name, call.args), call.name);
        }
      }
      messages.push({ role: "tool", text, callId: call.id });
    }
    if (answer.cut) messages.push({ role: "user", text: CUT_OFF });
    atLimit();
  }
}
