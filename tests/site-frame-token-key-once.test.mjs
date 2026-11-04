// The key a product's own token is kept under is computed in one place (ITM-659) — MOD-site-frame's `tokenKeyOf`, as docs/architecture/MOD-site-frame.md states it: "the key a product's own token is kept
// under in the browser's store: `github-token:<owner>/<repository>` for a GitHub product, `gitlab-token:<server>/<project>` for a GitLab product (MOD-browser-store, Data). It reads nothing and is the one
// place that rule stands, for the frame and for the pages that read a product's token setting, such as the name it is stored under." MOD-review-pages' `storedToken` and MOD-settings-pages' `tokenSettingKey`
// are such pages' readers; MOD-browser-store keeps its own `tokenKey` for the keys it converts, since it owns the key's format and uses no other module.
// Run: node --test tests/site-frame-token-key-once.test.mjs
//
// Module: MOD-site-frame · MOD-review-pages · MOD-settings-pages
// Guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN; DON'T REPEAT YOURSELF
// Level: unit
//
// The first test reads the source of the two functions: each calls `tokenKeyOf`, imported from MOD-site-frame's index, and spells no token key of its own. Its known positives are the functions that do hold the rule —
// `tokenKeyOf` in src/site-frame/routing.mjs and `tokenKey` in src/browser-store/legacy-keys.mjs — which the same reading finds spelling both forms. The second test states the keys the two functions give, which no
// refactoring changes: it is green before and after. A function's source is the text from its `function` line to the first line that is a closing brace at the left margin.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseAddress } from "../src/repository-hosts/index.mjs";
import { tokenKeyOf } from "../src/site-frame/index.mjs";
import { tokenSettingKey } from "../src/settings-pages/products.mjs";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
// The text of the function `name` in `text`, from its line to the closing brace at the left margin, or the one line of an arrow function.
const sourceOf = (text, name) => {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => new RegExp(`^(export )?(function ${name}\\(|const ${name} = )`).test(line));
  assert.ok(at >= 0, `${name} stands in the file`);
  if (!lines[at].endsWith("{")) return lines.slice(at, at + 2).join("\n");
  const end = lines.findIndex((line, i) => i > at && line === "}");
  return lines.slice(at, end + 1).join("\n");
};
const spellsKeys = (source) => source.includes("github-token:") && source.includes("gitlab-token:");
const importsTokenKeyOf = (text) => /import\s*\{[^}]*\btokenKeyOf\b[^}]*\}\s*from\s*"\.\.\/site-frame\/index\.mjs"/.test(text);

// TST-659001 · level: unit · module: MOD-review-pages · MOD-settings-pages
// guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN; DON'T REPEAT YOURSELF
// given: src/review-pages/common.mjs and src/settings-pages/products.mjs, and, as the known positives, tokenKeyOf in src/site-frame/routing.mjs and tokenKey in src/browser-store/legacy-keys.mjs
// input: the source of storedToken and of tokenSettingKey is read, and the imports of their files
// expect: each of the two calls tokenKeyOf, spells neither token key form, and its file imports tokenKeyOf from ../site-frame/index.mjs; counter-proof — the same reading finds both forms spelled in tokenKeyOf and in tokenKey, and finds no call of tokenKeyOf in tokenKey
test("storedToken and tokenSettingKey compute the key through tokenKeyOf and spell no key of their own", () => {
  assert.ok(spellsKeys(sourceOf(read("src/site-frame/routing.mjs"), "tokenKeyOf")), "known positive: the one place spells both forms");
  const legacy = sourceOf(read("src/browser-store/legacy-keys.mjs"), "tokenKey");
  assert.ok(spellsKeys(legacy), "known positive: MOD-browser-store spells both forms for the keys it converts");
  assert.ok(!legacy.includes("tokenKeyOf("), "MOD-browser-store calls no other module's function");
  for (const [path, name] of [["src/review-pages/common.mjs", "storedToken"], ["src/settings-pages/products.mjs", "tokenSettingKey"]]) {
    const text = read(path);
    const source = sourceOf(text, name);
    assert.ok(source.includes("tokenKeyOf("), `${name} calls tokenKeyOf`);
    assert.ok(!source.includes("github-token:") && !source.includes("gitlab-token:"), `${name} spells no token key form`);
    assert.ok(importsTokenKeyOf(text), `${path} imports tokenKeyOf from the frame's index`);
  }
});

// TST-659002 · level: unit · module: MOD-settings-pages · MOD-site-frame
// guards: A GITHUB PRODUCT USES A TOKEN OF ITS OWN
// given: a GitHub product https://github.com/acme/widgets and a GitLab project https://gitlab.example.org/team/app, each as parseAddress reads it
// input: tokenSettingKey and tokenKeyOf of each
// expect: github-token:acme/widgets for the GitHub product and gitlab-token:gitlab.example.org/team/app for the GitLab project, from both functions; counter-proof — the two products' keys differ
test("tokenSettingKey and tokenKeyOf give the same key, github-token for GitHub and gitlab-token for GitLab", () => {
  const github = parseAddress("https://github.com/acme/widgets");
  const gitlab = parseAddress("https://gitlab.example.org/team/app");
  assert.equal(tokenKeyOf(github), "github-token:acme/widgets");
  assert.equal(tokenKeyOf(gitlab), "gitlab-token:gitlab.example.org/team/app");
  assert.equal(tokenSettingKey(github), "github-token:acme/widgets");
  assert.equal(tokenSettingKey(gitlab), "gitlab-token:gitlab.example.org/team/app");
  assert.notEqual(tokenKeyOf(github), tokenKeyOf(gitlab));
});
