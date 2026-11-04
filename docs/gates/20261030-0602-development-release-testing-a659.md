---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 194a03d0bc3baa7281551d5257688ea5e49f11b5
  - https://github.com/akmaier/agent-m/pull/1500
date: 2026-10-30 06:02 UTC
---
# Development → Release testing: ITM-659, the key a product's token is kept under is written once

**REGISTER**

## Reason

ITM-659, pull request #1500 into `sprint/team1/125`, passes on `194a03d0`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `33fb38c2`:** run 41010611411 fails in one job, and there only on TST-659001 of
     `tests/site-frame-token-key-once.test.mjs`. That is the item's reason: `storedToken` and `tokenSettingKey` still spell
     the key themselves.
   - **Head:** run 41010927876 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped.
2. **Only the item's files change.**
   - `src/review-pages/common.mjs`: `storedToken` pushes `tokenKeyOf(parseAddress(…))` for a product, and
     `github-token` for the instance, as before.
   - `src/settings-pages/products.mjs`: `tokenSettingKey` is `(address) => tokenKeyOf(address)`.
   - Both import `tokenKeyOf` from `../site-frame/index.mjs`, beside what each imports from it already. MOD-site-frame
     provides it (MOD-site-frame.md:239). MOD-review-pages and MOD-settings-pages name MOD-site-frame among their Uses,
     which the agreement of sprint 124 reads at the level of the module.
   - `src/browser-store/legacy-keys.mjs` is untouched: MOD-browser-store keeps its own `tokenKey`, as the item says.
   - The one new test file. No existing test changes.
3. **The test's header names an item module.**
   - The header is `Module: MOD-site-frame · MOD-review-pages · MOD-settings-pages`. `testHeader` reads it as
     `["MOD-site-frame"]`.
   - ITM-659 names MOD-site-frame, MOD-review-pages, MOD-settings-pages and MOD-browser-store (its `modules`). So the
     file is a test "that names one of those modules" (SPEC.md:1478-1482), whichever of the three is read.
   - `team1/125.md` listed only two of the item's modules beside the developer's name. The item's own list decides.
4. **TST-659001 reads code text, and that is acceptable.**
   - The item's Acceptance is that the two modules "keep no copy of it", while "no expected result of a test changes". The
     key is the same with and without the copy, so no case on the functions' results can tell them apart. Only their
     source can.
   - A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT (SPEC.md:1515-1520) concerns the SPEC, a use case or an
     architecture file. The test reads code files, and states its expected result in its own text, as TST-1111001 does
     (gate `20261030-0428-development-release-testing-a1111.md`, Noted).
   - Its known positives are asserted in the case: `tokenKeyOf` and MOD-browser-store's `tokenKey` each spell both forms.
     That is the agreement of sprint 124.
   - TST-659002 states the keys both functions give, for a GitHub and a GitLab product. It is green before and after, so
     the behaviour is unchanged.
5. **Counter-proofs, made on the head and restored after.**
   - The old copy put back into `storedToken`: TST-659001 fails on "storedToken calls tokenKeyOf"; 1 pass, 1 fail.
   - `tokenSettingKey` spelling the GitLab form and calling `tokenKeyOf` for GitHub: TST-659001 fails on "tokenSettingKey
     spells no token key form".
   - Restored, 2 of 2.
6. **MOD-test-document's reader:**
   - `tests/site-frame-token-key-once.test.mjs`: 2 declarations, 0 findings. The header gives level `unit` and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - The declarations' `given`, `input` and `expect`, as the reader reads them:
     - **TST-659001** —
       - given: "src/review-pages/common.mjs and src/settings-pages/products.mjs, and, as the known positives, tokenKeyOf
         in src/site-frame/routing.mjs and tokenKey in src/browser-store/legacy-keys.mjs";
       - input: "the source of storedToken and of tokenSettingKey is read, and the imports of their files";
       - expect: "each of the two calls tokenKeyOf, spells neither token key form, and its file imports tokenKeyOf from
         ../site-frame/index.mjs; counter-proof — the same reading finds both forms spelled in tokenKeyOf and in tokenKey,
         and finds no call of tokenKeyOf in tokenKey".
     - **TST-659002** —
       - given: "a GitHub product https://github.com/acme/widgets and a GitLab project https://gitlab.example.org/team/app,
         each as parseAddress reads it";
       - input: "tokenSettingKey and tokenKeyOf of each";
       - expect: "github-token:acme/widgets for the GitHub product and gitlab-token:gitlab.example.org/team/app for the
         GitLab project, from both functions; counter-proof — the two products' keys differ".
7. **Locally on the head:** the file and `tests/test-document-one-line.test.mjs` give 4 pass, 0 fail. My planning run of
   the same change, over 198 files, found no case that fails only with it.
8. **Reads:** none change. `storedToken` reads the same one setting, under the same key.

## Noted

- The header and the declarations separate their modules with " · ". The reader takes the text before the first
  separator, so TST-659001 reads `module: MOD-review-pages` and TST-659002 `MOD-settings-pages`, and the header reads
  `MOD-site-frame` alone. Each is a module of the item, so no finding stands. MOD-test-document's Data gives one module
  per `Module:` line, so a later test names its others on lines of their own.
- The pull request's description names no runs. The runs are those above.
