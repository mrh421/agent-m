// MOD-maintenance-pages — the pages of issues and mail (docs/architecture/MOD-maintenance-pages.md): its interface. Of it, ITM-963 builds the route `mail` (mail.mjs) up to the author's decision; ITM-966 builds the routes `replies` and
// `replies/<issue>` (replies.mjs) up to the drafts, for which the view hands the frame MOD-mail-handling's `mailStrategies` (the kind `draft-replies` names its recipe and its writer); ITM-964 adds MOD-personal-data's `privacyStrategies` (the kinds `propose-issues` and `rewrite-without-persons` name the recipe `report-data` and the check `people-search`); ITM-582 builds the routes `issues` and
// `issue/<number>` (issues.mjs) up to the class confirmed, corrected or the issue rejected, for which the view hands the frame MOD-issue-handling's `issueStrategies` (the kind `analyse-issue` names its recipe). ITM-584 adds, to the issue route, the change of the SPEC from an issue, for which the view also hands the frame MOD-spec-changes' `specStrategies` and MOD-source-register's `sourceStrategies` (the kind `change-requirements` names the precondition `person-source`, its recipes and its writer). The fix of a bug, the move into the backlog and the sending and asking on the
// replies page are other items'.
//
// Module: MOD-maintenance-pages

import { issueStrategies } from "../issue-handling/index.mjs";
import { mailStrategies } from "../mail-handling/index.mjs";
import { privacyStrategies } from "../personal-data/index.mjs";
import { sourceStrategies } from "../source-register/index.mjs";
import { specStrategies } from "../spec-changes/index.mjs";
import { routes as issues } from "./issues.mjs";
import { route as mail } from "./mail.mjs";
import { route as replies } from "./replies.mjs";

export const view = { routes: [mail, replies, ...issues], strategies: [mailStrategies, privacyStrategies, issueStrategies, specStrategies, sourceStrategies] };
