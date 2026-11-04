---
id: ITM-1298
title: The issue route reads the backlog through MOD-work-plans
level: module
realises:
  - A BACKLOG ITEM NAMES THE MODULES IT CHANGES
modules:
  - MOD-issue-handling
  - MOD-maintenance-pages
builds_on:
  - ITM-1255
tests:
  - unit
origin:
  - developer-opus-f's stop on ITM-1255, sprint 112 (docs/backlog/sprints/team1/112.md, "ITM-1255's stop")
---
# ITM-1298 The issue route reads the backlog through MOD-work-plans

**REGISTER**

## Outcome

MOD-issue-handling and MOD-maintenance-pages each hold their own copies of rules of the backlog that MOD-work-plans
holds:
- **The module files read:** `src/issue-handling/backlog.mjs:19`, `:58`; `src/maintenance-pages/issues.mjs:235`, `:253`.
- **A list field split:** `listOf` (`backlog.mjs:29`) and `namesOf` (`issues.mjs:239`).
- **The item's file and identifier:** `backlog.mjs:20`; `issues.mjs:236-237`, `:263` (`BACKLOG_ITEM`, `backlogItems`).

MOD-work-plans' interface offers none of these (MOD-work-plans.md, `provides:`).

## The reading of the accepted text

The rules the copies keep are those of the artifacts' schemas, which MOD-documents owns, and both modules already use it.
- MOD-issue-handling's Uses name `MOD-documents.artifactSchemas`, `readDocument` and `Document`
  (MOD-issue-handling.md:26-28); MOD-maintenance-pages' name `artifactSchemas` and `readDocument`
  (MOD-maintenance-pages.md:31-33).
- `artifactSchemas` gives the schemas of an item and a module, with their path patterns, and `readDocument` reads a file
  of such a schema into a `Document`, its list fields read by the schema (MOD-documents.md:267-269, :307-308).
- So both modules read the items and module files through these, and their hand-written paths, list splits and
  identifier patterns go. MOD-work-plans gains nothing and does not change.

## Acceptance

- The two modules read the backlog's items and the module files through MOD-documents' `readDocument` and
  `artifactSchemas`, and keep no path rule, list split or item pattern of their own. The existing tests of both modules
  pass unchanged.
- Only the folders of the two modules and the tests that name them change.

## The reading, checked at sprint team1/127's planning

The reading does not hold for the items' paths. The item schema names two path patterns, `docs/plan/ITM-{nnn}-{slug}.md`
and `docs/backlog/ITM-{nnn}-{slug}.md` (`src/documents/schemas/item.schema.md:15-23`), so a path matched through the
schema is a plan step or a backlog item alike; `artifactSchemaOf` gives the item schema for both
(MOD-documents.md:309-311), and neither module's Uses names it. A module that reads only the backlog's items still
needs the rule `docs/backlog/` of its own.

**The reading taken.** The backlog's folder is the SPEC's own: "A product's backlog is kept as Markdown under
`docs/backlog/`" (`THE BACKLOG LIVES IN THE PRODUCT REPOSITORY`, SPEC.md:1675-1677). Each module keeps that one folder
name, to choose the backlog's items among the item schema's files; the item's file pattern, its identifier and its list
fields come from `artifactSchemas` and `readDocument`. So the Acceptance's "no path rule" reads: no rule beyond that
folder name.
