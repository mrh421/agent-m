// Every implemented key of MOD-browser-store's catalogue (docs/architecture/MOD-browser-store.md, Data): the instance's
// GitHub token, product tokens, products, notifications, endpoints, the paired Bridge, each Bridge under its name (`bridge:<name>`), the
// jump host, and recorded setting tests, plus named remote sessions and the key of a resource kept in this browser (`resource-key:<name>`). A key outside this catalogue is never written (writeSetting, in index.mjs).
//
// Module: MOD-browser-store

const LITERAL_KEYS = new Set(["github-token", "products", "notifications", "notified", "bridge", "jump-host", "mailbox", "browser", "not-an-issue"]);

// Key families this item names, each parameterised after its prefix: a GitHub product's own token
// (A GITHUB PRODUCT USES A TOKEN OF ITS OWN), a GitLab project's access token (A GITLAB PRODUCT USES A PROJECT ACCESS
// TOKEN), and the CLI session a Bridge offers for an agent (`session:<bridge>:<agent>`).
const KEY_FAMILIES = [/^github-token:.+$/, /^gitlab-token:.+$/, /^endpoint:.+$/, /^session:.+:[^:]+$/, /^bridge:.+$/, /^remote-session:.+$/, /^last-test:.+$/, /^acknowledged:.+$/, /^resource-key:.+$/];

// isKnownKey(key) -> whether `key` is one this item's catalogue names.
export function isKnownKey(key) {
  return LITERAL_KEYS.has(key) || KEY_FAMILIES.some((family) => family.test(key));
}
