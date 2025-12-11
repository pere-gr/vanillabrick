# BrickUI

BrickUI is an experimental **vanilla-JavaScript UI micro-framework** built around “bricks”:
small, self-contained components (grids, forms, etc.) wired together by a powerful event bus
and an extensible plugin system.

> **Status:** early alpha – architecture is still moving, APIs will break.
>  
> **Goal:** be a *real* playground for enterprise-style components (grids/forms) with
> strong lifecycle and events, but **zero runtime dependencies** and a **single JS file**.

---

## Why BrickUI?

Most component libraries give you tons of widgets but very little control over what happens
**before** and **after** something changes. You usually get a single callback (“onChange”),
often at the wrong time, and then you’re fighting the framework.

BrickUI is an experiment to flip that around:

- Every interesting thing is an **event** with 3 phases: `before` → `on` → `after`.
- Events are named like `namespace:action:target` and can use wildcards.
- Extensions subscribe to those events and can **cancel**, **modify**, or **react** to them.
- Components stay small and composable; “magic” lives in extensions.

All of this runs on plain JS, no bundler required to *use* it.

---

## Features (current snapshot)

- **Vanilla JS only**  
  Single runtime file: `dist/brickui.js` – no React, no jQuery, no dependencies. 

- **Bricks**  
  Each brick has:
  - an `id` and a `kind` (e.g. `grid`, `form`),
  - an **options controller** (`brick.options.*`),
  - an **event bus controller** (`brick.events.*`),
  - an **extensions controller** that installs plugins based on `for` / `requires`.

- **Event bus with phases**   
  - Event names like `data:sort:code`, `brick:ready:*`, `store:data:set`, …  
  - 3 phases: `before`, `on`, `after`.  
  - Synchronous `fire()` and async `fireAsync()`.

- **Extension system**   
  - Extensions declare:
    - `for`: which brick kinds they apply to.
    - `requires`: which brick namespaces must exist (`dom`, `store`, …).
    - `ns`: namespace where their public API will live on the brick.
    - `brick`: methods exported to `brick[ns].*` (API).
    - `extension`: internal helpers (`this` is the extension instance).
    - `events`: subscriptions to the event bus (`before`/`on`/`after`).
    - `init` / `destroy`: lifecycle hooks.

- **Auto-bootstrap from the DOM**   
  Any element with `class="bui"` becomes a brick; the `kind` is read from
  `brick-kind`, `data-kind` or `data-brick-kind`. The `dom` extension is wired
  automatically with the element as `dom.element`.

- **Grid demo** (work in progress)   
  - `grid` brick kind.  
  - `columns` extension: header rendering + sorting.  
  - `rows` extension: body rendering.  
  - `store` extension: in-memory data with `store.data:*` events.  
  - Click on a sortable header → raises `store:data:sort` → rows re-render.

---
## Demo

[Click here](https://pere-gr.github.io/brickui/)

---
## Quick start

Clone the repo and open the demo HTML file:

```bash
git clone https://github.com/pere-gr/brickui.git
cd brickui
# open index.html in a browser
