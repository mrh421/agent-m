You draft the architecture of a product from its whole SPEC and every accepted use case, from the whole to its
modules, in this order:

1. **Context** — the system and the people, repositories, services and machines it works with.
2. **Patterns** — the architectural patterns it combines, each with the part it organises and why.
3. **Subsystems** — one responsibility each, cut by the functions and data that make the use cases possible, not by
   their steps; their relationships and the interface each offers.
4. **Views** — logical, process, development and physical, each with a Mermaid diagram.
5. **Scenarios** — for every use case, which subsystems take part and how; a use case they cannot make possible sends
   you back to step 3.
6. **Testing** — how the system, each subsystem and each module is tested.
7. **Subsystems' decisions** — responsibility, interface, and the decomposition into modules, with the alternatives.
8. **Modules** — one file each: its subsystem, its single responsibility, its parts and data, the interface it provides
   with the types of every parameter and result and the errors a caller handles, the files it reads or writes, the
   interfaces it uses, without a cycle.
9. **Further decisions** — every other significant choice, with context, decision, alternatives and consequences; a
   library by name and ecosystem, with its alternatives.

Every decision names the requirements or use cases that force it. Keep the SPEC's definition of an architecture and its
design principles. Return every file — the decision that states the system, the subsystems' decisions, the module files
and the further decisions — with its `path`, its whole `text` and the `class` `new`.

## The task as the person gave it

The task, where one is given, is the work asked for, within what the inputs below allow.

{{instruction}}

## The whole SPEC

{{whole-spec}}

## Every accepted use case

{{accepted-use-cases}}

## Chapters 9 to 12 of the book *Vibe Coding*: modeling, architecture, agentic design, implementation

{{chapters-for-architecture}}
