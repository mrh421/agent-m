// Whether a failed request of a model endpoint is sent again, and after how long (MOD-endpoint-calls, Parts: retries.mjs).
//
// Module: MOD-endpoint-calls
//
// Ported from opencode v1.19.0, packages/opencode/src/session/retry.ts (https://github.com/anomalyco/opencode): at most five retries, the first after 2 s,
// each later one twice as long, with up to 25 % jitter; retry-after-ms and retry-after honoured; the patterns of a network error; a context overflow never
// retried. Changed: plain JavaScript; a delay the endpoint does not name is capped at 30 s whether or not it sent headers.
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

export const RETRY_INITIAL_DELAY = 2000;
export const RETRY_BACKOFF_FACTOR = 2;
export const RETRY_JITTER_FACTOR = 0.25;
export const RETRY_MAX_DELAY_NO_HEADERS = 30_000;
export const RETRY_MAX_DELAY = 2_147_483_647; // the most setTimeout waits
export const RETRY_MAX_RETRIES = 5;

const NETWORK = [
  /terminated|fetch failed|failed to fetch|network[-_\s]error|upstream connect|connection error|connection refused|connection lost|socket connection was closed|socket hang up|reset before headers|getaddrinfo|enotfound|eai_again|econnrefused|econnreset|etimedout/i,
  /^timeout$|\b(?:request|response|connection|network|stream|read) (?:timeout|timed out|time out)\b/i,
];

const exponential = (attempt, random) => {
  const base = RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1);
  return Math.ceil(base + base * RETRY_JITTER_FACTOR * random);
};

/**
 * retryDelay(attempt, headers, random = Math.random()) -> number — the milliseconds to wait before retry number `attempt` (from 1): the endpoint's
 * retry-after-ms, else its retry-after in seconds or as a date, else 2 s doubled for each earlier retry with up to 25 % jitter, at most 30 s.
 */
export function retryDelay(attempt, headers, random = Math.random()) {
  const header = (name) => headers?.get?.(name) ?? null;
  const retryAfterMs = Number.parseFloat(header("retry-after-ms"));
  if (!Number.isNaN(retryAfterMs)) return Math.min(retryAfterMs, RETRY_MAX_DELAY);
  const retryAfter = header("retry-after");
  if (retryAfter !== null) {
    const seconds = Number.parseFloat(retryAfter);
    if (!Number.isNaN(seconds)) return Math.min(Math.ceil(seconds * 1000), RETRY_MAX_DELAY);
    const until = Date.parse(retryAfter) - Date.now();
    if (!Number.isNaN(until) && until > 0) return Math.min(Math.ceil(until), RETRY_MAX_DELAY);
  }
  return Math.min(exponential(attempt, random), RETRY_MAX_DELAY_NO_HEADERS);
}

/**
 * retryable(status, diagnosis) -> boolean — whether a failed request is sent again: never a context overflow (`too long`); a rate limit (429) and a server
 * error (5xx) always; a request that got no answer when it was `not reachable` by a network's error — never a call a browser blocked, which no retry
 * changes.
 */
export function retryable(status, diagnosis) {
  if (diagnosis.reason === "too long") return false;
  if (Number.isFinite(status)) return status === 429 || status >= 500;
  return diagnosis.reason === "not reachable" && NETWORK.some((pattern) => pattern.test(diagnosis.message));
}

/** wait(ms, signal) -> Promise<void> — resolves after `ms`, or rejects with the signal's reason when it is aborted first. */
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
    const stop = () => { clearTimeout(timer); reject(signal.reason); };
    signal?.addEventListener("abort", stop, { once: true });
  });
}
