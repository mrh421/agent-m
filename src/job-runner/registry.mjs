// The strategies registered by name, for the life of the program (MOD-job-runner, Parts: registry.mjs).
//
// Module: MOD-job-runner
//
// A program registers each module's strategies once, before its first job; the runner itself registers its built-ins. A
// name is registered once within its category — recipes, checks, preconditions, steps, writers, tools.

const CATEGORIES = ["recipes", "checks", "preconditions", "steps", "writers", "tools"];
const registry = new Map(CATEGORIES.map((category) => [category, new Map()]));

// A failure of the runner's own, by name, with the fields the module file gives it.
export const failure = (name, message, fields) => Object.assign(new Error(message), { name, ...fields });

/**
 * registerStrategies(owner: string, strategies: Partial<Strategies>) -> void — adds the named strategies a module offers.
 * Throws DuplicateStrategy { strategy, owners } when a name is registered twice with another strategy, and then adds none of them; the same
 * strategy handed again, by any owner, stays registered under its first owner.
 */
export function registerStrategies(owner, strategies) {
  const adding = CATEGORIES.flatMap((category) => Object.entries(strategies[category] ?? {})
    .map(([name, strategy]) => ({ category, name, strategy })));
  for (const { category, name, strategy } of adding) {
    const registered = registry.get(category).get(name);
    if (registered && registered.strategy !== strategy) {
      throw failure("DuplicateStrategy", `the ${category} ${name} is registered by ${registered.owner} and again by ${owner}`,
        { strategy: name, owners: [registered.owner, owner] });
    }
  }
  for (const { category, name, strategy } of adding) if (!registry.get(category).has(name)) registry.get(category).set(name, { owner, strategy });
}

// The registrations a program hands in to be made later (registerLater), each made once, before the runner first looks a strategy up.
const later = [];
let making = null;

/**
 * registerLater(register: () => Promise<void>) -> void — a registration the program hands in now and the runner makes before it first looks a
 * strategy up (registeredAll), so that a page loads the strategies' modules only when a job is prepared, run or written.
 */
export function registerLater(register) {
  later.push(register);
}

/**
 * registeredAll() -> Promise<void> — makes every registration handed to registerLater that is not made yet, each once, in the order handed; a
 * failure of one is thrown, and it stays first: it and the ones after it are made at the next call.
 */
export function registeredAll() {
  return making ??= (async () => {
    try {
      while (later.length) {
        await later[0]();
        later.shift();
      }
    } finally { making = null; }
  })();
}

/** registered(category: string, name: string) -> boolean — whether a module registered a strategy under the name. */
export const registered = (category, name) => registry.get(category).has(name);

/**
 * strategyOf(category: string, name: string) -> Function — the strategy registered under the name. Throws
 * UnknownStrategy { strategy } for a name no module registered.
 */
export function strategyOf(category, name) {
  const registered = registry.get(category).get(name);
  if (!registered) throw failure("UnknownStrategy", `no module registered the ${category} ${name}`, { strategy: name });
  return registered.strategy;
}
