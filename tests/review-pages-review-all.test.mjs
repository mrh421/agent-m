// MOD-review-pages' route use-case/all (ITM-356), as the accepted text of docs/architecture/MOD-review-pages.md states it: "Review
// all: every open or changed file of the kind in sequence, a changed one as its difference, a new one in full, and Accept all N shown:
// one commit with one record per file shown; a file that changed after it was shown, or that names a requirement or use case not yet
// accepted, is left out and named" — UC-008 3e: "Review all opens one page with every open or changed use case in sequence … Below them,
// Accept all N shown — one click — writes one commit with one record per use case on the page, each naming the text shown there. A use
// case that changed after the page was built is left out and named."
// Run: node --test tests/review-pages-review-all.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; ONE CLICK PER DECISION; AN APPROVAL NAMES THE EXACT TEXT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged (its document and its localStorage), and brings
// the repository the same way: a Host of the tests' own over one repository in memory with a history, keeping to MOD-repository-hosts'
// interface; every call recorded. The real MOD-approvals, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network.
// Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The route is the route `use-case` with the id `all`: the address #use-case/id=all, as one file is #use-case/id=<id>. The list
//     links to it with "Review all".
//   - A use case is a <section class="review-file" data-id="UC-nnn"> with its status; a changed one holds <section class="accepted-diff">
//     with the difference, a new one its text; the accepted ones are not on the page. The button is "Accept all N shown", class
//     accept-all, with N the number of sections.
//   - A click calls MOD-approvals' acceptShown once, with the blob of each text as shown, and the page is drawn again from the
//     repository, saying the commit and naming each use case left out with its reason and the names it rests on.
//   - Without a token on GitHub the page offers, for each use case, GitHub's prefilled page for its record, as the page of one use case
//     does; on GitLab without a token it offers none and links the token's step, #add.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import { scripted } from "./review-pages-harness.mjs";
import { until } from "./review-pages-wait.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "use-case");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const ON_GITLAB = { server: "gitlab", origin: "https://gitlab.example.org", path: "team/product", web: "https://gitlab.example.org/team/product" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", "**A LOAN HAS A DUE DATE** *(Product Owner)*",
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const useCase = (id, title, sentence, realises = "A LOAN HAS A DUE DATE") => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:",
  "  - Member", "realises:", `  - ${realises}`, "---", `# ${id} ${title}`, "", `**Goal.** ${sentence}`);
const P = { 41: "docs/use-cases/UC-041-check-out-a-book.md", 42: "docs/use-cases/UC-042-extend-a-loan.md", 43: "docs/use-cases/UC-043-return-a-book.md",
  44: "docs/use-cases/UC-044-reserve-a-book.md", 45: "docs/use-cases/UC-045-renew-a-card.md", 46: "docs/use-cases/UC-046-fine-a-member.md" };
const UC41 = useCase("UC-041", "Check out a book", "The member borrows a book at the desk.");
const UC42 = useCase("UC-042", "Extend a loan", "The member extends a loan once.");
const UC43_OLD = useCase("UC-043", "Return a book", "The member returns a book at the desk.");
const UC43 = useCase("UC-043", "Return a book", "The member returns a book and the card at the desk.");
const UC44 = useCase("UC-044", "Reserve a book", "The member reserves a book that is out.");
const UC44_EDITED = useCase("UC-044", "Reserve a book", "The member reserves a book that is out, for a week.");
const UC45 = useCase("UC-045", "Renew a card", "The member renews the card for a year.");
const UC46 = useCase("UC-046", "Fine a member", "The desk fines a member for a late book.", "A FINE IS CHARGED PER DAY");
const recordOf = (id, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`,
  text("kind: use-case", `file: ${path}`, `blob: ${blobOf(body)}`)];
// Five use cases: UC-041 and UC-044 open, UC-042 and UC-045 accepted, UC-043 changed since its earlier text was accepted.
const STEPS = [
  { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [P[41]]: UC41, [P[42]]: UC42, [P[43]]: UC43_OLD, [P[44]]: UC44, [P[45]]: UC45 },
  Object.fromEntries([recordOf("UC-042", P[42], UC42), recordOf("UC-043", P[43], UC43_OLD), recordOf("UC-045", P[45], UC45)]),
  { [P[43]]: UC43 },
];

// ---------------------------------------------------------------- the fake host

function fakeHost({ steps = STEPS, repository = ON_GITHUB, refuse = null } = {}) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of steps) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null]));
      },
      async readSnapshot(ref) {
        if (ref === "main") return { ...snapshotAt(head), ref };
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (refuse) throw refuse;
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${repository.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

function contextOf(fake, { token = true, gitlab = false } = {}) {
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, gitlab ? "gitlab-token:gitlab.example.org/team/product" : "github-token:alice/thesis-tool", TOKEN);
  return { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: (gitlab ? ON_GITLAB : ON_GITHUB).web, kind: gitlab ? "gitlab" : "github", host: fake.host } };
}
async function show(fake, params = { id: "all" }, options = {}) {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, contextOf(fake, options), params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
const sections = (target) => byClass(target, "section", "review-file");
const idsOf = (target) => sections(target).map((section) => section.getAttribute("data-id"));
const buttonOf = (target) => byClass(target, "button", "accept-all")[0];

// ---------------------------------------------------------------- the page

// TST-472651 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-008
// given: five use cases — UC-041 and UC-044 open, UC-043 changed since its earlier text was accepted, UC-042 and UC-045 accepted —, and a token stored
// input: the route use-case rendered with the id all
// expect: three sections, UC-041, UC-043, UC-044 in that order, each with its identifier, title and status; UC-041 and UC-044 in full (their sentence on the page, no difference); UC-043 as its difference to the last accepted text — the earlier sentence removed, the new one added — headed "Changed since it was last accepted"; neither accepted use case on the page; the button "Accept all 3 shown"; the folded What is this?; nothing written
test("MOD-review-pages use-case/all — every open or changed use case in sequence, a changed one as its difference, a new one in full", async () => {
  const fake = fakeHost();
  const target = await show(fake);

  assert.deepEqual(idsOf(target), ["UC-041", "UC-043", "UC-044"]);
  const [first, second, third] = sections(target);
  assert.match(first.textContent, /UC-041 Check out a book[^]*open/);
  assert.match(second.textContent, /UC-043 Return a book[^]*changed since acceptance/);
  assert.match(third.textContent, /UC-044 Reserve a book[^]*open/);
  for (const [section, sentence] of [[first, "The member borrows a book at the desk."], [third, "The member reserves a book that is out."]]) {
    assert.ok(section.textContent.includes(sentence), `${sentence} in full`);
    assert.equal(byClass(section, "section", "accepted-diff").length, 0, "no difference for a new use case");
  }
  const diff = byClass(second, "section", "accepted-diff")[0];
  assert.ok(diff, "a difference for the changed use case");
  assert.match(diff.textContent, /Changed since it was last accepted/);
  const shown = byClass(diff, "pre", "diff")[0].textContent;
  assert.match(shown, /- \*\*Goal\.\*\* The member returns a book at the desk\./);
  assert.match(shown, /\+ \*\*Goal\.\*\* The member returns a book and the card at the desk\./);
  for (const accepted of ["UC-042", "UC-045", "Extend a loan", "Renew a card"]) assert.ok(!target.textContent.includes(accepted), `${accepted} is not on the page`);
  assert.equal(buttonOf(target).textContent, "Accept all 3 shown");
  assert.equal(byClass(target, "details", "explain").length >= 1, true, "a folded What is this?");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472652 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; ONE CLICK PER DECISION; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON
// given: the page above with its token
// input: a click on Accept all 3 shown
// expect: one commit on `main`, on the head that was read, naming the person the token is stored under, holding three files — the records of UC-041, UC-043 and UC-044, each "kind: use-case", the use case's path and the blob of the text shown; then the page drawn again from the repository: nothing to review, no button, and the commit named
test("MOD-review-pages use-case/all — Accept all 3 shown writes one commit with three records", async () => {
  const fake = fakeHost();
  const read = fake.head();
  const target = await show(fake);
  click(buttonOf(target));
  await until(target, () => fake.writes().length === 1, "the commit");
  const [{ change }] = fake.writes();

  assert.equal(change.branch, "main");
  assert.equal(change.expectedHead, read, "on the head that was read");
  assert.match(change.message, new RegExp(`Accepted by ${TOKEN.name}`));
  const expected = [recordOf("UC-041", P[41], UC41), recordOf("UC-043", P[43], UC43), recordOf("UC-044", P[44], UC44)]
    .map(([path, body]) => ({ path, text: body }));
  assert.deepEqual([...change.files].sort((a, b) => a.path.localeCompare(b.path)), expected, "three records, each naming the text shown");
  await until(target, () => idsOf(target).length === 0, "the page to show nothing left to review");
  assert.match(target.textContent, /Nothing to review/);
  assert.equal(buttonOf(target), undefined, "no button any more");
  assert.match(target.textContent, new RegExp(fake.head().slice(0, 7)), "the commit is named");
});

// TST-680204 · level: unit · module: MOD-review-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the review page of the use cases with a token
// input: a click a script makes (isTrusted false) on Accept all; then the person's click
// expect: after the script's click no commit is attempted; after the person's click one commit
test("MOD-review-pages use-case/all — counter-proof: a click a script makes on Accept all writes nothing", async () => {
  const fake = fakeHost();
  const target = await show(fake);
  const all = buttonOf(target);
  all.dispatchEvent(scripted());
  for (let turn = 0; turn < 40; turn++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fake.writes().length, 0, "no commit attempted");
  click(all);
  await until(target, () => fake.writes().length === 1, "the commit of the person's click");
});

// TST-472653 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// given: the page above built; then another writer's commit changed UC-044 on `main`
// input: a click on Accept all 3 shown
// expect: one commit with two records, UC-041's and UC-043's, naming the blobs shown; UC-044 named as left out with the reason that it changed since it was shown, and still open on the page drawn again
test("MOD-review-pages use-case/all — a use case changed after the page was built is left out and named", async () => {
  const fake = fakeHost();
  const target = await show(fake);
  fake.land({ [P[44]]: UC44_EDITED });
  click(buttonOf(target));
  await until(target, () => fake.writes().length === 1, "the commit");

  assert.deepEqual(fake.writes()[0].change.files.map((file) => file.path).sort(),
    [recordOf("UC-041", P[41], UC41)[0], recordOf("UC-043", P[43], UC43)[0]].sort());
  await until(target, () => idsOf(target).join() === "UC-044", "the page to show UC-044 alone");
  assert.match(target.textContent, /UC-044 was left out: changed since shown/);
  assert.equal(buttonOf(target).textContent, "Accept all 1 shown");
});

// TST-472654 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: the product above with a sixth use case, UC-046, that realises A FINE IS CHARGED PER DAY, a requirement the SPEC does not hold
// input: the page, and a click on Accept all 4 shown
// expect: one commit with the records of UC-041, UC-043 and UC-044 and not UC-046; UC-046 named as left out with the reason that it rests on what is not accepted and the name of that requirement
test("MOD-review-pages use-case/all — a use case that names a requirement not yet accepted is left out and named", async () => {
  const fake = fakeHost({ steps: [...STEPS, { [P[46]]: UC46 }] });
  const target = await show(fake);
  assert.equal(buttonOf(target).textContent, "Accept all 4 shown");
  click(buttonOf(target));
  await until(target, () => fake.writes().length === 1, "the commit");

  assert.equal(fake.writes()[0].change.files.length, 3);
  assert.ok(!fake.writes()[0].change.files.some((file) => file.path.includes("UC-046")), "no record for UC-046");
  await until(target, () => idsOf(target).join() === "UC-046", "the page to show UC-046 alone");
  assert.match(target.textContent, /UC-046 was left out: rests on what is not accepted \(A FINE IS CHARGED PER DAY\)/);
});

// TST-472655 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: a product whose use cases are all accepted
// input: the route use-case rendered with the id all
// expect: no section, the statement that there is nothing to review, no button
test("MOD-review-pages use-case/all — with every use case accepted there is nothing to review", async () => {
  const fake = fakeHost({ steps: [STEPS[0], Object.fromEntries([recordOf("UC-041", P[41], UC41), recordOf("UC-042", P[42], UC42),
    recordOf("UC-043", P[43], UC43_OLD), recordOf("UC-044", P[44], UC44), recordOf("UC-045", P[45], UC45)]), { [P[43]]: UC43 },
    Object.fromEntries([recordOf("UC-043", P[43], UC43)]) ] });
  const target = await show(fake);

  assert.deepEqual(idsOf(target), []);
  assert.match(target.textContent, /Nothing to review/);
  assert.equal(buttonOf(target), undefined);
});

// TST-472656 · level: unit · module: MOD-review-pages
// guards: ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page above with a token, and a host that refuses the commit with PermissionMissing
// input: the page rendered, then a click on Accept all 3 shown
// expect: nothing written until the click; after it the refusal said in the host's words and the button pressable again, the three use cases still on the page
test("MOD-review-pages use-case/all — a refused commit is said, and the page stays", async () => {
  const refusal = failure("PermissionMissing", "Your token may not write to https://github.com/alice/thesis-tool: it lacks Contents.");
  const fake = fakeHost({ refuse: refusal });
  const target = await show(fake);
  assert.equal(fake.writes().length, 0, "nothing written before the click");
  click(buttonOf(target));
  await until(target, () => /lacks Contents/.test(target.textContent), "the refusal");

  assert.deepEqual(idsOf(target), ["UC-041", "UC-043", "UC-044"]);
  assert.notEqual(buttonOf(target).disabled, true, "pressable again");
  assert.equal(fake.head() !== undefined && fake.writes().length, 1, "one attempt");
});

// ---------------------------------------------------------------- without a token

// TST-472657 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: a GitHub product, no token stored in this browser
// input: the route use-case rendered with the id all
// expect: no Accept all button; for each of the three use cases a link to GitHub's new-file page whose address holds the record's path and the record and nothing else — no text of the use case —; nothing written
test("MOD-review-pages use-case/all — without a token on GitHub: one prefilled GitHub page for each record, holding no text", async () => {
  const fake = fakeHost();
  const target = await show(fake, { id: "all" }, { token: false });

  assert.equal(buttonOf(target), undefined, "no Accept all");
  const links = byClass(target, "a", "github-page");
  assert.equal(links.length, 3);
  const wanted = [recordOf("UC-041", P[41], UC41), recordOf("UC-043", P[43], UC43), recordOf("UC-044", P[44], UC44)];
  links.forEach((link, at) => {
    const page = new URL(link.getAttribute("href"));
    assert.equal(page.origin + page.pathname, "https://github.com/alice/thesis-tool/new/main");
    assert.deepEqual([...page.searchParams.keys()].sort(), ["filename", "value"]);
    assert.equal(page.searchParams.get("filename"), wanted[at][0]);
    assert.equal(page.searchParams.get("value"), wanted[at][1]);
    assert.ok(!decodeURIComponent(link.getAttribute("href")).includes("Goal."), "no text in the address");
  });
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472658 · level: unit · module: MOD-review-pages
// guards: A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
// given: a product on a GitLab server, no token of its own stored
// input: the route use-case rendered with the id all
// expect: the three use cases shown; no Accept all, no link to a GitHub page; a link to the step that stores the project's token
test("MOD-review-pages use-case/all — a GitLab product without a token: no Accept all, and the token's step linked", async () => {
  const fake = fakeHost({ repository: ON_GITLAB });
  const target = await show(fake, { id: "all" }, { token: false, gitlab: true });

  assert.deepEqual(idsOf(target), ["UC-041", "UC-043", "UC-044"]);
  assert.equal(buttonOf(target), undefined);
  assert.equal(find(target, (node) => node.localName === "a" && /github\.com/.test(node.getAttribute("href") ?? "")).length, 0);
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href")?.startsWith("#add/")).length, 1);
});

// ---------------------------------------------------------------- the way to it

// TST-472659 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: the list of use cases
// input: the route use-case rendered with no id
// expect: a link "Review all" to #use-case/id=all/product=<the product's address, percent-encoded>; and on the page of one use case no such section as a review-all page
test("MOD-review-pages use-case — the list links to Review all", async () => {
  const target = await show(fakeHost(), {});

  const links = find(target, (node) => node.localName === "a" && node.getAttribute("href") === `#use-case/id=all/product=${encodeURIComponent(ON_GITHUB.web)}`);
  assert.equal(links.length, 1);
  assert.match(links[0].textContent, /Review all/);
  assert.equal(sections(target).length, 0, "the list is no review-all page");
});
