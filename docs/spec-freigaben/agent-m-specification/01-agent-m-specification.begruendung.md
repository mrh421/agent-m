# Preamble: a change is proposed in the queue of its section

**The change.** "Each change is proposed in `docs/spec-freigaben/<date>_<name>/`" becomes "Each change is proposed in the
queue of its section, `docs/spec-freigaben/<section>/`". Every other byte of the preamble is carried over.

**Why.** akmaier, 2026-11-01: "Spec-Freigaben packages: aren't packages modules?" — one package per SPEC section, as a
module is one folder. The package is named after the section's heading without its number, so that it names the section
by its identifier, not by its position (`A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION`); the preamble's package is
named after the title. How a package is named and written is stated in MOD-spec-changes, Data — akmaier: "The convention
lives in MOD-spec-changes' Data." —, not in the SPEC.

**Alternatives.**
- Keep a queue per date and name: every change of one section stays scattered over as many folders as days it was
  changed on, and the reader of a section finds its changes only through the approval records.

**Impact list.**
- no requirement of the preamble changes; nothing outside the SPEC names the preamble.

**Origin.** akmaier's decision of 2026-11-01 on the SPEC change packages.
