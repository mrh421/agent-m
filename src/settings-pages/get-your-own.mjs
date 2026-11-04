// The route `get-your-own` — getting one's own Agent M (UC-014 steps 1 to 5), as docs/architecture/MOD-settings-pages.md states it: "the fork, Pages and Actions steps with
// their direct links once the owner is known". The page asks for the person's GitHub name, or the organisation to fork into (one used for nothing else is recommended, with the
// reason folded underneath), and shows four steps: Step 1 · Fork opens GitHub's fork page of Agent M; Step 2 · Turn on the dashboard opens exactly the repository's Settings > Pages
// and says what to choose there; Step 3 · Turn on the workflows is optional now and offers Later; Step 4 · Open your dashboard opens the Pages address of the fork. The links of Steps
// 2 to 4 appear once a GitHub name is known: typed, named by the address (`#get-your-own/owner=<name>`) or read from the person's own instance. The address
// `#get-your-own/step=actions`, which MOD-review-pages links, opens the Actions step. Each step carries its folded explanation (EVERY STEP EXPLAINS ITSELF), and Agent M's MIT licence
// stands beside them with its own. The page requests nothing, stores nothing and writes nothing: it only links GitHub's pages (the pages are MOD-repository-hosts' webLinks, the
// dashboard's address is MOD-identifiers' pagesAddress). `Finish setting up` — the token — is the route `setup`, which the person's own dashboard shows next.
//
// Module: MOD-settings-pages

import { parseAddress, connect } from "../repository-hosts/index.mjs";
import { pagesAddress } from "../identifiers/index.mjs";
import { explain } from "../site-frame/index.mjs";
import { heads } from "./routes.mjs";

// The repository that is forked, and the name the fork keeps (GitHub's default).
const UPSTREAM = "akmaier/agent-m";
const FORK_NAME = "agent-m";
const STEP_NAMES = ["fork", "pages", "actions", "open"];
// A GitHub name: letters, digits and single hyphens, neither starting nor ending with a hyphen, at most 39 characters.
const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// A link to a page of GitHub or of the person's Pages site, opened in a new tab.
function link(label, href, className) {
  const anchor = el("a", className, label);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  return anchor;
}

const webLinksOf = (repository) => connect(parseAddress(`https://github.com/${repository}`), {}).webLinks();

// The GitHub name a page opens with: the address names it, else the owner of the person's own instance (the original's owner is no one's own).
function ownerOpened(params, instanceRepository) {
  if (params.owner !== undefined) return params.owner;
  return instanceRepository === UPSTREAM ? "" : instanceRepository.split("/")[0];
}

export const route = {
  ...heads.getYourOwn,
  async render(target, context, params = {}) {
    let owner = ownerOpened(params, context.instance.repository).trim();
    let step = STEP_NAMES.includes(params.step) ? params.step : "fork";

    const field = el("input", "owner");
    field.type = "text";
    field.value = owner;
    field.placeholder = "your-github-name";
    field.autocomplete = "off";
    field.spellcheck = false;
    const problem = el("p", "problem muted");
    const steps = el("div", "steps");

    // The step section: its title, its words, its link or the reason it has none, and its folded explanation. The current one is marked.
    const section = (name, title, words, action, topic, ...more) => {
      const node = el("section", name === step ? "step current" : "step", el("h3", null, title), ...words.map((text) => el("p", null, text)), action, ...more, explain(topic));
      if (name === step) node.setAttribute("aria-current", "step");
      return node;
    };
    const paint = () => {
      const known = GITHUB_NAME.test(owner);
      const repository = `${owner}/${FORK_NAME}`;
      const first = "Enter your GitHub name first.";
      const links = known ? webLinksOf(repository) : null;
      const later = el("button", "later btn", "Later");
      later.addEventListener("click", () => { step = "open"; paint(); });
      problem.textContent = owner && !known ? "A GitHub name has letters, digits and single hyphens." : "";
      steps.replaceChildren(
        section("fork", "Step 1 · Fork", [`GitHub's fork page of ${UPSTREAM} opens; press "Create fork".`],
          link("Open GitHub's fork page ↗", webLinksOf(UPSTREAM).fork), "get-your-own-fork"),
        section("pages", "Step 2 · Turn on the dashboard",
          ["On that page choose \"Deploy from a branch\", the branch \"main\" and the folder \"/ (root)\", and press \"Save\". GitHub lets no one but the owner switch this on."],
          known ? link("Open the Pages settings ↗", links.pagesSettings) : el("p", "muted", first), "get-your-own-pages"),
        section("actions", "Step 3 · Turn on the workflows — optional now",
          ["The workflows of your fork are needed only to fetch EU legal texts and to write an accepted change of the instance's own SPEC without a token; everything else works without them.",
            "GitHub disables workflows on every fork until its owner enables them: on that page press \"I understand my workflows, go ahead and enable them\". The dashboard shows this step again when a feature first needs them."],
          known ? link("Open the Actions page ↗", links.actions) : el("p", "muted", first), "get-your-own-actions", later),
        section("open", "Step 4 · Open your dashboard",
          ["Your dashboard is the Pages site of your fork. GitHub needs about a minute after Step 2 before the address answers."],
          known ? link("Open your dashboard ↗", pagesAddress(repository)) : el("p", "muted", first), "get-your-own-open"));
    };

    field.addEventListener("input", () => { owner = field.value.trim(); paint(); });
    paint();

    target.replaceChildren(
      el("section", "head", el("h2", null, "Get your own Agent M"),
        el("p", "muted", "Your own dashboard, your own settings and your own list of products, in four steps on GitHub.")),
      el("div", "owner-field", el("label", null, "Your GitHub name — or the organisation to fork into", " ", field), explain("get-your-own-owner")),
      problem,
      steps,
      el("section", "licence", el("p", null, "Agent M is MIT-licensed, which is what allows the fork. The licence of every product stays yours."), explain("get-your-own-licence")));
    // A FORM OPENS WITH ITS FIRST FIELD FOCUSED: the person's GitHub name.
    field.focus();
  },
};
