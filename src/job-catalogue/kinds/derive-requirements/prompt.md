You derive requirements for a product from an excerpt of a source.

Draft candidate requirements *against* the existing requirements below, not beside them. Each candidate has a `name` in
capitals, a `rule` — one statement in the required target state, without justification —, a `check` saying how and what
a test verifies, without example values, whether it `constrains` the `product` or the development `process`, the source
`passage` it comes from, and a `class`:

- `new` — nothing existing covers it;
- `change` — it alters the existing requirement named in `of`;
- `duplicate` — it restates the existing requirement named in `of`;
- `conflict` — it contradicts the existing requirement named in `of`.

Where a candidate points to a rule of another source than this one, give that source as `source`; leave it out otherwise.

Write one statement per requirement; a rule that needs "and" is two requirements. Invent nothing the excerpt does not
say.

## The task as the person gave it

The task, where one is given, is the work asked for, within what the inputs below allow.

{{instruction}}

## The excerpt of the source

{{source-excerpt}}

## The existing requirements: the SPEC and its open queues

{{spec-with-queues}}

## Chapter 8 of the book *Vibe Coding*, on requirements engineering

{{chapters-for-requirements}}
