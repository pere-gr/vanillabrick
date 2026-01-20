# ADR 0002: Baked Prototypes for Extensions

## Status
Accepted

## Context
Extensions in VanillaBrick define logic that should be applied to bricks. Creating new object instances and binding methods for every extension on every brick is expensive (CPU and Memory).

## Decision
We implement a **Baking** mechanism for extension definitions:
- When an extension is first encountered (or during registry initialization), we "bake" its definition into a prototype object (`protoExt` for internal context and `protoApi` for public methods).
- These prototypes are cached globally in `VanillaBrick.runtime.prototypes`.
- When a brick installs an extension, it creates its instance using `Object.create(protoExt)`, avoiding property duplication and method binding.
- Public APIs are similarly "baked": a single generic method on the prototype handles calls for all instances by looking up specific instance data in a hidden registry (`_extData`).

## Consequences
- **Positive:** Extremely fast brick initialization.
- **Positive:** Minimal memory overhead for method storage.
- **Positive:** Changes to base extension logic (if needed dynamically) can propagate through the prototype chain.
- **Negative:** Slightly more complex registry logic (`_bake` process).
