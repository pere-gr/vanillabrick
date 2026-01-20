# ADR 0001: Global Singleton Controllers for Core Logic

## Status
Accepted

## Context
VanillaBrick needs to manage multiple instances of "Bricks" (components) efficiently. Initially, each brick could have its own instance of controllers (Events, Options, etc.), but this leads to high memory overhead and complex state management when bricks need to interact or share logic patterns.

## Decision
We will use a **Global Singleton Controller** pattern for all core logic. 
- Controllers (Runtime, Events, Options, Status, Extensions) are instantiated once at the engine's boot time.
- These controllers do not hold per-brick state internally.
- Per-brick state is stored within each Brick instance (inside an isolated `_runtime` property).
- The controllers receive the brick instance as the first argument in their internal methods to operate on the correct state.

## Consequences
- **Positive:** Reduced memory footprint.
- **Positive:** Centralized logic and error handling (via RuntimeController).
- **Positive:** Easier debugging and tracing of global lifecycle.
- **Negative:** Internal controller methods require passing the `brick` context explicitly (e.g., `controller.set(brick, ...)`).
- **Neutral:** Public APIs on the brick are wrappers that call these singleton methods.
