# VanillaBrick Technical Roadmap

This document outlines the architectural improvements, performance optimizations, and new core features planned for VanillaBrick. It serves as a guide for future development phases.

## 🚀 Core Features & API

### 1. Request/Response Pattern (RPC)
**Current State:** Data retrieval relies on `fireAsync` and manual conventions (e.g., writing to `ev.result`), or direct controller access.
**Proposal:** Implement a standardized `brick.request('namespace:cmd:target', payload)` method.
- Returns a `Promise` resolving to a value, not the event object.
- Handles scenarios with multiple responders (race, all, or first).
- Essential for service-oriented architecture (getting data from a Store without coupling).

### 2. State Machine (`brick.status`)
**Current State:** Component state (loading, empty, error) is managed via ad-hoc boolean flags (e.g., `this.isLoading`).
**Proposal:** Formalize a `brick.status` property backed by a lightweight state machine.
- Standard states: `idle`, `loading`, `ready`, `error`, `destroyed`.
- Automatic event emission on transition: `status:change:loading`.
- Allows global UI extensions (like spinners or error toasts) to react automatically to brick states.

### 3. Safe HTML Templating
**Current State:** Extensions often use `innerHTML` with string concatenation, which is prone to XSS and hard to read.
**Proposal:** Add a core utility `VanillaBrick.html` (Tagged Template Literal).
- Automatic sanitization of inputs to prevent XSS.
- Cleaner syntax for DOM generation within extensions.
- Zero-dependency alternative to heavy DOM libraries.

---

## ⚡ Performance & Internals

### 4. Event Batching (Microtask Scheduler)
**Current State:** Setting options or firing events is synchronous. A loop updating 50 items triggers 50 DOM renders.
**Proposal:** Implement a **Scheduler** using Microtasks (`Promise.resolve`) or `requestAnimationFrame`.
- Batch multiple `options.set` calls into a single update cycle.
- Deduplicate render requests to ensure the DOM is touched only once per frame.

### 5. Production Mode (Runtime Overhead)
**Current State:** The `EventsController` and `ExtensionsController` wrap user code in `try/catch` blocks (via `RuntimeController`) for safety and debugging.
**Proposal:** Introduce `VanillaBrick.env = 'dev' | 'prod'`.
- In `prod`, the wrapper is bypassed completely.
- Executes code "bare metal" for maximum performance.
- In `dev`, retains full stack traces and error handling.

### 6. Memory Optimization ("Zero-Bind") — ~~pending~~ implemented in core
**Current State:** Extensions bind methods to specific instances (`.bind(brick)` or `.bind(ext)`), creating new function closures for every single brick.
**Proposal:** ~~Refactor the invocation strategy to avoid `.bind()`.~~
- ~~Use "Call Context" injection or hidden references (`this._brick`).~~
- ~~Allow thousands of bricks to share the exact same function generic in memory.~~
- ~~Reduces Heap footprint significantly for high-density UIs (e.g., spreadsheet cells as bricks).~~
**Status:** Implemented in core (runtime + extensions controller) with shared context `{brick, ext}` and no `.bind()`.
