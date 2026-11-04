// The classes of candidates — MOD-documents' classifyCandidates (docs/architecture/MOD-documents.md, Interfaces: Candidate,
// Classified and classifyCandidates): the candidates of one run merged where they state the same rule, and each class decided by rule
// where the rule is an existing artifact's.
//
// Module: MOD-documents
//
// The rules are those of A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT, CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// and EXACT DUPLICATES ARE FOUND WITHOUT A MODEL, and they are the same for every kind of artifact: only the key differs, and
// the caller gives it, as the list of values `keys` — for a requirement its name and its rule — the rule decides —, for an
// architecture decision its title. Nothing here reads a schema, a document or a file.

// A value of a key as it is compared: in lower case, every run of white space one blank and none at either end, every quotation
// mark one mark and every dash one dash.
const normalised = (value) => String(value ?? "").toLowerCase()
  .replace(/[\p{Pi}\p{Pf}"'\u201A\u201E]/gu, "'")
  .replace(/\p{Pd}/gu, "-")
  .replace(/\s+/g, " ")
  .trim();

// Whether two keys, their values normalised, are one key: the value that decides is the same. A requirement's key is its name and
// its rule, and its rule decides — the last value of its key —: a name alone joins nothing, so a candidate under an existing
// name with another rule is no duplicate and keeps its class, a change (A CHANGE IS PROPOSED UNDER THE EXISTING NAME), and a
// rule that equals another, under whatever name, is the same requirement (EXACT DUPLICATES ARE FOUND WITHOUT A MODEL). A key of
// one field — a title, an identifier — is decided by that field. A blank value names nothing.
const same = (a, b) => a.at(-1) !== "" && a.at(-1) === b.at(-1);

/**
 * classifyCandidates(candidates, existing) -> Classified[] — the classes of one run's candidates against the existing artifacts
 * of their kind. First the candidates whose keys have the same normalised deciding value — a requirement's rule, a one-field key's field — are merged
 * into one, which names every passage they came from; the sharing is followed from one candidate to the next. Then a merged candidate
 * that shares that value with an existing artifact is a duplicate of it — of the first such artifact in `existing` —, decided by rule, whatever its
 * participant proposed. Every other candidate keeps the class and the artifact its participant proposed, those of the first of
 * them for candidates merged into one. The artifact a candidate of a one-field key is proposed as a change of is not searched: a
 * change stands under the name of what it changes. A requirement — a key of more than one value — whose rule equals that of the
 * requirement it is proposed as a change of is a duplicate of it all the same. The classes stand in the order of their first candidates.
 * @param {Array<{ ref: string, keys: string[], from: string[], proposed: { class: string, of: string | null } }>} candidates
 * @param {Array<{ id: string, keys: string[] }>} existing
 * @returns {Array<{ refs: string[], from: string[], class: string, of: string | null, decidedBy: "rule" | "participant" }>}
 */
export function classifyCandidates(candidates, existing) {
  const keys = candidates.map((candidate) => candidate.keys.map(normalised));
  const known = existing.map((artifact) => ({ id: artifact.id, keys: artifact.keys.map(normalised) }));

  // The groups of candidates that share a key, each as the places of its candidates in the draft, in order. A candidate joins
  // every group it shares a key with, and so joins those groups into one.
  let groups = [];
  candidates.forEach((_, i) => {
    const joined = groups.filter((members) => members.some((j) => same(keys[i], keys[j])));
    groups = [...groups.filter((members) => !joined.includes(members)), [...joined.flat(), i].sort((a, b) => a - b)];
  });
  groups.sort((a, b) => a[0] - b[0]);

  return groups.map((members) => {
    const first = candidates[members[0]];
    // A change stands under the name of what it changes (A CHANGE IS PROPOSED UNDER THE EXISTING NAME): for a key of one field — a
    // module's identifier, a decision's title — the artifact the first candidate is proposed as a change of is left out of the search
    // for a duplicate. A requirement's key has more than one value, and its rule decides: one that restates the rule of the
    // requirement it is proposed as a change of is a duplicate of that requirement all the same.
    const changed = first.proposed.class === "change" && keys[members[0]].length === 1 ? first.proposed.of : null;
    const duplicateOf = known.find((artifact) => artifact.id !== changed && members.some((i) => same(keys[i], artifact.keys)));
    return {
      refs: members.map((i) => candidates[i].ref),
      from: [...new Set(members.flatMap((i) => candidates[i].from))],
      class: duplicateOf ? "duplicate" : first.proposed.class,
      of: duplicateOf ? duplicateOf.id : first.proposed.of,
      decidedBy: duplicateOf ? "rule" : "participant",
    };
  });
}
