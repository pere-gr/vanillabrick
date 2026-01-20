# ADR 0004: Event-Driven Lifecycle Phases

## Status
Accepted

## Context
Extensions often need to intercept or augment the behavior of other extensions or core features. A simple event system isn't enough to manage "pre" and "post" logic consistently across the system.

## Decision
We implement a **Three-Phase Event Pipeline**:
- Every triggered event runs through three sequential phases: `before`, `on`, and `after`.
- The `before` phase allows for validation or cancellation (`ev.cancel = true`).
- The `on` phase is for the primary action.
- The `after` phase is for side effects and notifications.
- Handlers are executed asynchronously (supporting `await`) but sequentially within their phase.
- Handlers can stop the current phase execution using `ev.stopPhase = true`.

## Consequences
- **Positive:** Highly extensible architecture without deep coupling.
- **Positive:** Predictable execution order.
- **Positive:** Built-in support for asynchronous operations in the middleware/interceptor layer.
- **Negative:** Slightly higher overhead per event dispatch compared to a basic EventEmitter.
