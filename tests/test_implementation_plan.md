# Implementation Plan Cases

The product of every case is the same small architecture: the system `ARC-001`, the subsystem `ARC-002` that designs the
modules `MOD-a` and `MOD-b`, and `MOD-b` using the interface `MOD-a.read`. A plan has a step for each module (unit tests), one
for the integration of `ARC-002` (component tests) and one for the system (system tests and release tests). A case gives the
steps, their order and the phase of each, and the expected findings of the check, each as `<rule> | <what>`.

## a plan in the order of the interfaces is accepted

The counter-proof of every refusal below: the module `MOD-a` first, `MOD-b` after it, then the subsystem's integration, then
the system. The check finds nothing.

### Case

```json
{
  "groups": ["assembly","level"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["unit"] },
      { "id": "ITM-002", "title": "B", "level": "module", "modules": ["MOD-b"], "tests": ["unit"] },
      { "id": "ITM-003", "title": "Sub", "level": "subsystem", "modules": ["MOD-a", "MOD-b"], "integrates": "ARC-002", "tests": ["component"] },
      { "id": "ITM-004", "title": "Whole", "level": "system", "modules": ["MOD-a", "MOD-b"], "tests": ["system", "release"] }
    ],
    "order": ["ITM-001", "ITM-002", "ITM-003", "ITM-004"]
  },
  "expected": { "findings": [] }
}
```

## a module without a step is refused and named

The plan of the first case without the step of `MOD-b`.

### Case

```json
{
  "groups": ["assembly"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["unit"] },
      { "id": "ITM-003", "title": "Sub", "level": "subsystem", "modules": ["MOD-a", "MOD-b"], "integrates": "ARC-002", "tests": ["component"] },
      { "id": "ITM-004", "title": "Whole", "level": "system", "modules": ["MOD-a", "MOD-b"], "tests": ["system", "release"] }
    ],
    "order": ["ITM-001", "ITM-003", "ITM-004"]
  },
  "expected": { "findings": ["AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES | MOD-b has no step"] }
}
```

## a subsystem without a step is refused and named

The plan of the first case without the integration of `ARC-002`.

### Case

```json
{
  "groups": ["assembly"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["unit"] },
      { "id": "ITM-002", "title": "B", "level": "module", "modules": ["MOD-b"], "tests": ["unit"] },
      { "id": "ITM-004", "title": "Whole", "level": "system", "modules": ["MOD-a", "MOD-b"], "tests": ["system", "release"] }
    ],
    "order": ["ITM-001", "ITM-002", "ITM-004"]
  },
  "expected": { "findings": ["AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES | the subsystem ARC-002 has no step for its integration"] }
}
```

## the system without a step is refused and named

The plan of the first case without the step of the system.

### Case

```json
{
  "groups": ["assembly"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["unit"] },
      { "id": "ITM-002", "title": "B", "level": "module", "modules": ["MOD-b"], "tests": ["unit"] },
      { "id": "ITM-003", "title": "Sub", "level": "subsystem", "modules": ["MOD-a", "MOD-b"], "integrates": "ARC-002", "tests": ["component"] }
    ],
    "order": ["ITM-001", "ITM-002", "ITM-003"]
  },
  "expected": { "findings": ["AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES | the system (ARC-001) has no step"] }
}
```

## a module ordered before one whose interface it uses is refused and named

The steps of the first case with the step of `MOD-b` ordered before the step of `MOD-a`, whose interface `MOD-b` uses.

### Case

```json
{
  "groups": ["assembly"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["unit"] },
      { "id": "ITM-002", "title": "B", "level": "module", "modules": ["MOD-b"], "tests": ["unit"] },
      { "id": "ITM-003", "title": "Sub", "level": "subsystem", "modules": ["MOD-a", "MOD-b"], "integrates": "ARC-002", "tests": ["component"] },
      { "id": "ITM-004", "title": "Whole", "level": "system", "modules": ["MOD-a", "MOD-b"], "tests": ["system", "release"] }
    ],
    "order": ["ITM-002", "ITM-001", "ITM-003", "ITM-004"]
  },
  "expected": { "findings": ["A RUN FOLLOWS THE MODULES' INTERFACES | MOD-b is ordered before MOD-a, whose interface it uses"] }
}
```

## a step of a module with the tests of another level is refused and named

The first case with the step of `MOD-a` naming component tests, which are the tests of a subsystem.

### Case

```json
{
  "groups": ["level"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["component"] },
      { "id": "ITM-002", "title": "B", "level": "module", "modules": ["MOD-b"], "tests": ["unit"] },
      { "id": "ITM-003", "title": "Sub", "level": "subsystem", "modules": ["MOD-a", "MOD-b"], "integrates": "ARC-002", "tests": ["component"] },
      { "id": "ITM-004", "title": "Whole", "level": "system", "modules": ["MOD-a", "MOD-b"], "tests": ["system", "release"] }
    ],
    "order": ["ITM-001", "ITM-002", "ITM-003", "ITM-004"]
  },
  "expected": { "findings": ["A PLAN STEP NAMES THE TESTS OF ITS LEVEL | ITM-001 is of level module and names tests of another level: component"] }
}
```

## a step of the system with unit tests only is refused and named

The first case with the step of the system naming unit tests.

### Case

```json
{
  "groups": ["level"],
  "input": {
    "steps": [
      { "id": "ITM-001", "title": "A", "level": "module", "modules": ["MOD-a"], "tests": ["unit"] },
      { "id": "ITM-002", "title": "B", "level": "module", "modules": ["MOD-b"], "tests": ["unit"] },
      { "id": "ITM-003", "title": "Sub", "level": "subsystem", "modules": ["MOD-a", "MOD-b"], "integrates": "ARC-002", "tests": ["component"] },
      { "id": "ITM-004", "title": "Whole", "level": "system", "modules": ["MOD-a", "MOD-b"], "tests": ["unit"] }
    ],
    "order": ["ITM-001", "ITM-002", "ITM-003", "ITM-004"]
  },
  "expected": { "findings": ["A PLAN STEP NAMES THE TESTS OF ITS LEVEL | ITM-004 is of level system and names tests of another level: unit"] }
}
```
