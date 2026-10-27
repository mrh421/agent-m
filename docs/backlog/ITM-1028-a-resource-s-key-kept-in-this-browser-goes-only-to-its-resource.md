---
id: ITM-1028
title: A resource's key kept in this browser goes only to its resource
level: module
realises:
  - UC-040
  - A RESOURCE CREDENTIAL GOES ONLY TO ITS RESOURCE
  - CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE
modules:
  - MOD-browser-store
  - MOD-reuse-facts
  - MOD-settings-pages
builds_on:
tests:
  - unit
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-040-7, read against the accepted texts on main at 40e04d8d
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
built_by:
  - f265d919e96aaa653cb265882bce6e1a0dd58509
  - 05caafb47d9f282ae740e875169c766cc9ccdec1
  - ba117b4140b9925f89d87e0e451f2bb3812f6f00
---
# ITM-1028 A resource's key kept in this browser goes only to its resource

**REGISTER**

## Outcome

UC-040.md:112-114: the credential may be held "as a **key in this browser**, stored in `localStorage` and sent only to that
resource's server"; 3c (:170-171): "Agent M asks for a Hugging Face token at step 5 and uses it only for requests to
Hugging Face." MOD-resource-list's Secret column allows `browser` (MOD-resource-list.md:64).

## The accepted text

The draft for this item is accepted (`1c30ad0b` and the acceptances before it); quoted from `main` at 40e04d8d:

MOD-browser-store.md:75-75:

> | `resource-key:<name>` | `{ value, stored }` — the key of the resource `<name>` whose list entry names its secret `browser` (MOD-resource-list), sent only to that resource's own server (UC-040) | the value |

## Acceptance

- Unit tests: `writeSetting(store, "resource-key:hub-model", …)` is accepted and shown as a secret; `hubFacts(id, key)`
  sends the key in `Authorization` only to `https://huggingface.co`, and a request elsewhere carries none; the resources
  page stores a typed key under `resource-key:<name>`.
- Counter-proof: a key sent to another origin fails the test.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of the named modules and their tests change.

**Read at sprint team1/93 (developer-sonnet-a): met.** Existing tests cover its Acceptance:
- TST-1073004: the key stored as a secret of this browser;
- TST-996003 (`src/reuse-facts/index.mjs:365-372`): a Hub key only in `Authorization` to the Hub's origin;
- TST-1073002 and 003: the key nowhere else on the page.
The one request that broke the rule, the key sent to a Bridge, is ITM-1074.

