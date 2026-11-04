---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0e62ceaaee7c86c0b1f5bd97348eddb434841c9a
  - https://github.com/akmaier/agent-m/pull/1419
date: 2026-10-29 08:40 UTC
---
# Development → Release testing: ITM-1278, Process models reads each product's declaration alone

**REGISTER**

## Reason

ITM-1278, pull request #1419 into `sprint/team1/114`, passes on `0e62ceaa`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40843264079, `pull_request`, on `0e62ceaa` passes 38 of 38 pull-request jobs.
2. **Red first.** The two commits before the implementation hold only tests.
   - **`854d97ef`, run 40842782271.** One job fails, component shard 5, and in it only TST-1278001 and 003.
     - TST-1278001 fails for the item's reason: the route sends a `tree` request where the test expects the folders
       request (`graphql`).
     - TST-1278003 fails for the same reason.
     - TST-1278002 passes, as it should: it pins what the page shows, which stays as it was.
   - **`e34545ab`, run 40841350058**, failed three jobs:
     - the same two cases;
     - TST-1169002, because the new declarations' fields ran onto a second line. `854d97ef` writes each on one line and
       changes no assertion.
     - `review-pages-release-limitations` "waited for the tag", the flip already registered as ITM-1287.
   - The implementation commit `0e62ceaa` changes only `src/implementation-pages/process.mjs`, and no test.
3. **Only its module changes.**
   - Code: `src/implementation-pages/process.mjs`. `declarationsOf` calls `readSnapshot(defaultBranch, { folders:
     [DECLARATION_PATH] })`, and the route's comment says so.
   - Tests: the new `tests/implementation-pages-models-declarations.test.mjs` and
     `tests/implementation-pages-models.test.mjs`. The headers of both name MOD-implementation-pages.
   - As its Acceptance says, no test of another module changes.
   - Every function the code calls is named in MOD-implementation-pages' Uses: `readSnapshot` and `repositoryInfo`
     (MOD-implementation-pages.md:21-22).
4. **The Outcome is the accepted text** (MOD-implementation-pages.md:158-159): "from each product's `docs/process.md`
   alone, through a snapshot of its default branch narrowed to that file (MOD-repository-hosts' `readSnapshot` with
   `folders`), never the product's whole tree".
5. **The fixture change of `implementation-pages-models` belongs where it stands.**
   - It is in the tests-only commit `e34545ab`, not in the implementation commit.
   - It changes the fake's GraphQL answer only: it also answers the `e<i>` aliases of `readSnapshot` with `folders`,
     with the file's oid, and otherwise as before.
   - No assertion and no `expect:` of that file changes, between `e34545ab^` and `0e62ceaa`.
   - Without the change, the narrowed read finds no `docs/process.md` in that fake, and TST-778002's listing would fail.
     The change lets the existing expectation be checked through the new read, and weakens none.
6. **No counter-proof is weakened.**
   - The counter-proof the Acceptance names is TST-1278003: a product without a declaration is shown without a model.
     It was red on the tests-only commit for the item's reason, and is unchanged since.
   - TST-1278001's known positive stands: the same fake records a `git/trees` request for a read of the whole tree.
7. **The readings in the pull request hold.**
   - **The `repositoryInfo` request stays.** The Acceptance counts "its commit, one folders request and one read of
     `docs/process.md`". The default branch's name is what `readSnapshot` is given, and the route asked for it before
     this change too. The Acceptance does not withdraw it.
   - **A product without `docs/process.md` has no file read.** The narrowed snapshot names no blob, so there is no blob
     to read. TST-1278003 pins that the product is shown without a model, and not as unreadable.
8. **The reader.** On `0e62ceaa`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `implementation-pages-models-declarations`: 3 declarations, TST-1278001 to 003, and 0 findings.
   - `implementation-pages-models`: 7 declarations and 0 findings.
