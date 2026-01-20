# ADR 0003: Zero-Bind Context Pattern

## Status
Accepted

## Context
Standard JavaScript patterns often rely on `.bind(this)` or closures to maintain context. In a high-density component system like VanillaBrick, creates millions of function instances, killing performance and increasing GC pressure.

## Decision
We adopt a **Zero-Bind** policy:
- We never use `.bind(this)` for core extension handlers or API methods.
- Instead of binding `this.options` to an instance, we use **Getters** on the baked prototypes.
- These getters (e.g., `get options() { return this.brick.options; }`) resolve the context at runtime without needing individual property assignments.
- Event handlers are passed as **Descriptors** (`{ fn, ctx, meta }`) instead of pre-bound functions. The `EventsController` and `RuntimeController` use `fn.apply(ctx, args)` only when execution is needed.

## Consequences
- **Positive:** Maximum performance and lowest memory usage.
- **Positive:** Cleaner code without "closure hell".
- **Positive:** Transparent execution via `RuntimeController` (it always knows the `fn`, `ctx`, and `meta` independently).
- **Negative:** Requires strict adherence to prototype-based design; developers must avoid defining methods as closures within the extension object.
