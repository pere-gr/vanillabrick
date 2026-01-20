# Architecture Decision Records (ADR)

This directory contains the records of architectural decisions made during the development of VanillaBrick.

## Index

*   [ADR 0001: Global Singleton Controllers](./0001-global-singleton-controllers.md) - Use of unique controllers across the system to save memory.
*   [ADR 0002: Baked Prototypes for Extensions](./0002-baked-prototypes-for-extensions.md) - Generation of "baked" prototypes to accelerate instance creation.
*   [ADR 0003: Zero-Bind Context Pattern](./0003-zero-bind-context-pattern.md) - Strategy to avoid `.bind(this)` and reduce closure usage.
*   [ADR 0004: Event-Driven Lifecycle Phases](./0004-event-driven-lifecycle-phases.md) - Event system with phases (before/on/after).
*   [ADR 0005: Isolated Runtime Shadow State](./0005-isolated-runtime-shadow-state.md) - Protection of internal state within the `_runtime` object.

---
*Note: These records serve as a historical log and technical reference for the project's architecture.*
