# ADR 0005: Isolated Runtime Shadow State

## Status
Accepted

## Context
Exposing internal state directly on the `Brick` instance can lead to property name collisions with extensions and makes it harder to distinguish between public API surface and private engine data.

## Decision
All internal engine state for a brick is stored in a non-enumerable `_runtime` property:
- This property is created via `Object.defineProperty` with `enumerable: false`.
- It contains sub-objects for each controller: `_runtime.events`, `_runtime.options`, `_runtime.status`, `_runtime.extensions`.
- Public APIs (e.g., `brick.options.get()`) are proxies that read from/write to this private `_runtime` shadow state.

## Consequences
- **Positive:** Clean public API surface.
- **Positive:** Protection against accidental state modification by user code or extensions.
- **Positive:** Easier serialization of the "public" state of a brick (since `_runtime` is hidden).
- **Negative:** Internal debugging requires looking into non-enumerable properties (though modern DevTools handle this easily).
- **Negative:** Slightly more indirect access for engine logic.
