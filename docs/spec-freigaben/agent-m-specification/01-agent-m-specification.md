# Agent M — Specification

**VERBINDLICH (SPEC)**

This is the single binding document of Agent M. A sentence belongs here when its violation would
be a defect. Everything else — how something is built, what was measured, what is planned —
belongs in `PLAN.md`, in `docs/measurements/`, or in the code, and does not bind.

**No section of this file is written by hand.** Each change is proposed in the queue of its section,
`docs/spec-freigaben/<section>/`, shown on the review dashboard beside the text it would replace,
and written only when the Product Owner accepts it there (`ACCEPTANCE IS A COMMIT BY THE ACCEPTING
PERSON`).

**Form of a requirement:** a **name** in capitals that is its identifier and never changes, its
**source**, one **rule** stated as a single testable sentence, and the **check** that guards it. One
statement per requirement — an "and" in the rule means it is two. Why a rule exists is recorded with
the decision that accepted it; its history is in the version history.

---
