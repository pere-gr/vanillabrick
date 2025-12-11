# BrickUI

BrickUI is a small, experimental, event-driven UI/runtime built with **plain JavaScript**.  
It’s a **functional proof of concept** that explores how far you can go with simple “bricks” and a powerful event/extension model, without frameworks or heavy dependencies.

> Load a script, create some bricks, wire extensions and events, and let the page react.

Check the demo [text](https://pere-gr.github.io/brickui/)
---

## Why BrickUI?

Most UI stacks today come with:

- Large dependency trees and complex tooling.
- Strong coupling between components and the DOM.
- Highly opinionated architectures that are hard to adopt incrementally.

BrickUI is an experiment in the opposite direction:

- **No mandatory build tools** for using it (just a `<script>` tag).
- **No framework lifecycle** to learn.
- **Everything is just JavaScript objects** with clear contracts.

The goal is to see how far a lean, event-driven runtime can go for real-world, data-heavy apps (forms, grids, “enterprise” screens) **without** sacrificing simplicity.

---

## What BrickUI is (and is not)

- ✅ A **functional proof of concept** for:
  - Event-driven components (“bricks”).
  - A 3-phase event model (`before`, `on`, `after`).
  - A powerful, declarative **extension** mechanism.
- ✅ A small, focused runtime aimed at **vanilla JS** and **simple integration**.

- ❌ It is **not** positioned as a framework (yet).
- ❌ It is **not** production-ready.
- ❌ It does **not** try to replace React/Vue/Angular.

Think of BrickUI as a **playground** for an idea: a clean architecture where components + extensions + events can cover most “enterprise UI” needs using just JavaScript.

---

## Core Concepts

### 1. Bricks

A **Brick** is the basic unit. It can represent:

- A visual component (e.g. a form, grid, field).
- A non-visual “service brick” (e.g. data loader, validator, workflow).

Conceptually, a Brick:

- Has a unique `id` and a `kind`.
- Owns a set of **controllers** (options, events, extensions, etc.).
- Acts as the **`this` context** for handlers and extension APIs.

You typically construct a brick by passing an options object; the runtime normalizes it and wires everything internally.

### 2. Event System (before / on / after)

BrickUI revolves around a **3-phase event pipeline**:

- `before` – pre-processing, validation, veto logic.
- `on` – core logic (do the thing).
- `after` – post-processing, side effects, logging, etc.

Events are identified by a string pattern:

```text
namespace:event:target
