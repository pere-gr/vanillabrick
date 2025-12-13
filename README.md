# VanillaBrick

VanillaBrick is an experimental **vanilla-JavaScript UI micro-framework** built around "bricks":
small, self-contained components (grids, forms, background services, etc.) wired together by
a powerful event bus and an extensible plugin system.

> **Status:** early alpha -- architecture is still moving, APIs will break.  
> **Goal:** a real playground for enterprise-style components (grids/forms) and
> headless services, with strong lifecycle & events, **zero runtime dependencies**
> and a **single JS file**.

---

## Why VanillaBrick?

Most component libraries give you lots of widgets but very little control over what happens
**before** and **after** something changes. You usually get a single callback (`onChange`),
often at the wrong time, and then you're fighting the framework.

VanillaBrick is an experiment to flip that around:

- Every interesting thing is an **event** with 3 phases: `before` -> `on` -> `after`.
- Events are named strictly `namespace:type:target` (3 segments).
- Listeners can use wildcards (`*`) to match any segment.
- Extensions subscribe to those events and can **cancel**, **modify**, or **react** to them.
- Components stay small and composable; "behaviour" lives in extensions and services.

All of this runs on plain JS -- no bundler required to *use* it.

---

## Features (current snapshot)

- **Vanilla JS only**  
  Single runtime file: `dist/VanillaBrick.js`. No React, no jQuery, no external deps.

- **Bricks (with or without DOM)**  
  Each brick has:
  - an `id` and a `kind` (e.g. `grid`, `form`, `service`),
  - an **options controller** (`brick.options.*`),
  - an **event bus controller** (`brick.events.*`),
  - an **extensions controller** that installs plugins based on `for` / `requires`.
  - a **runtime controller** (`brick.runtime.*`) that wraps code execution for safety and debugging.

  A brick **does not need a DOM element**.  
  You can use bricks as pure, headless components (state + events + extensions) to implement
  services, data pipelines, orchestration logic, etc.

- **Event bus with phases**  
  - Event names like `brick:status:ready`, `store:data:set`, `store:data:sort`.  
  - 3 phases: `before`, `on`, `after`.  
  - Synchronous `fire()` and async `fireAsync()`.

- **Extension system**  
  - Extensions declare:
    - `for`: which brick kinds they apply to.
    - `requires`: which brick namespaces must exist (`dom`, `store`, etc.).
    - `ns`: namespace where their public API will live on the brick.
    - `brick`: methods exported to `brick[ns].*` (public API).
    - `extension`: internal helpers (`this` is the extension instance).
    - `events`: subscriptions to the event bus (`before` / `on` / `after`).
    - `options`: default options merged into the brick.
    - `init` / `destroy`: lifecycle hooks.

- **Auto-bootstrap from the DOM (optional)**  
  Any element with `class="vb"` becomes a brick; the `kind` is read from
  `brick-kind`, `data-kind` or `data-brick-kind`. The `dom` extension is wired
  automatically with the element as the brick's root.

  This is just a convenience for **UI bricks**.  
  You can also create bricks manually from JS for **headless bricks / services**.

- **Grid demo** [(work in progress)](https://pere-gr.github.io/vanillabrick/)  
  - `grid` brick kind.  
  - `columns` extension: header rendering + sorting.  
  - `rows` extension: body rendering.  
  - `store` extension: in-memory data with `store.data:*` events.  
  - Click on a sortable header -> raises `store:data:sort` -> rows re-render.

---

## Quick start

Clone the repo and open the demo HTML file:

```bash
git clone https://github.com/pere-gr/VanillaBrick.git
cd VanillaBrick
# open index.html in a browser
```

Minimal example (adapted from the demo):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>VanillaBrick demo</title>

  <!-- Demo styles only -->
  <link rel="stylesheet" href="./demos/demo.css" />

  <!-- VanillaBrick runtime -->
  <script defer src="./dist/VanillaBrick.js"></script>
  <!-- Optional: your own script (to set options, etc.) -->
  <script defer src="./demos/demo.js"></script>
</head>
<body>
  <h1>VanillaBrick demo</h1>

  <table id="grid1" class="vb vb-grid" brick-kind="grid">
    <thead></thead>
    <tbody></tbody>
  </table>
</body>
</html>
```

When the DOM is ready, VanillaBrick automatically:

1. Finds `.vb` elements.
2. Creates a `VanillaBrick.brick` for each one.
3. Applies all matching extensions (dom, store, grid, columns, rows, etc.).
4. Fires `brick:status:ready`.

You can then grab the instance from JS:

```js
const grid = VanillaBrick.base.getBrick('grid1');
grid.columns.sort('code');        // triggers a store:data:sort event
grid.store.set(newRowsArray);     // triggers store:data:set + re-render
```

---

## Core concepts

### Bricks

Bricks are the basic runtime unit. They can be UI bricks **bound to the DOM** or
headless bricks used purely as services.

```js
// UI brick bound to a DOM element
const grid = new VanillaBrick.brick({
  id: 'grid1',
  kind: 'grid',
  dom: { id: 'grid1' }
});

// Headless brick (no DOM), e.g. a service
const service = new VanillaBrick.brick({
  id: 'nexus-service',
  kind: 'service'
});
```

Each brick:

- stores options via the **options controller**,
- handles events via the **event bus controller**,
- gets extensions installed via the **extensions controller**.

Internally, controllers live under `brick._controllers`, but each exposes a small public API
on the brick:

- `brick.options.get(...)`, `set(...)`, `all()`, etc.  
- `brick.events.fire(...)`, `fireAsync(...)`, `on(...)`.

### Options controller

Options are just a flattened key/value store:

```js
grid.options.set('grid.columns', [
  { datafield: 'code', label: 'Code', sortable: true },
  { datafield: 'name', label: 'Name', sortable: true }
]);

const cols = grid.options.get('grid.columns');
```

Extensions can provide default options (they're applied silently during install).

### Event bus

Event names are strings in the strict form:
```text
namespace:type:target
```
- **Namespace**: Context (e.g., `brick`, `store`).
- **Type**: Verification (e.g., `ready`, `set`, `click`).
- **Target**: Subject/ID (e.g., `now`, `grid1`, `header-row`).
**Important**: You must provide exactly 3 segments. No more, no less.
Wildcards (`*`) are allowed in listeners, but **forbidden** when firing events.
Examples:
- `brick:status:ready`
- `store:data:set`
- `store:data:sort`
- `dom:click:my-btn`

You can subscribe with phases:

```js
grid.events.on('store:data:*', 'before', 0, function (ev) {
  // this === brick
  console.log('about to change store data', ev.data);
});
```

And fire events:

```js
grid.events.fire('store:data:set', { data: rowsArray });
await grid.events.fireAsync('store:data:sort', { field: 'code', dir: 'asc' });
```

Extensions also subscribe through their `events` definition (see next section).

### Extensions

A typical extension looks like this (simplified):

```js
VanillaBrick.extensions.columns = {
  for: ['grid'],
  requires: ['dom', 'store', 'grid'],
  ns: 'columns',
  options: {},

  // Methods exposed as grid.columns.*
  brick: {
    get: function () { /* this === brick */ },
    sort: function (field, dir) { /* this === brick */ }
  },

  // Internal helpers (this === extension instance)
  extension: {
    _normalizeArray: function (value, fallback) { /* ... */ }
  },

  // Event subscriptions
  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function (ev) {
          // this === extension instance
          // build <thead> based on this.brick.columns.get()
        }
      }
    },
    {
      for: 'store:data:sort:*',
      after: {
        fn: function (ev) {
          // update sort state, etc.
        }
      }
    }
  ],

  init: function () {
    // this === extension instance
    // called once when extension is installed
    return true;
  },

  destroy: function () {
    // cleanup
  }
};
```

At install time the extensions controller:

1. Checks `for` and `requires` to see if the extension applies to the brick.  
2. Binds `extension.*` helpers to the extension instance.  
3. Applies default `options` into the brick options.  
4. Binds `brick.*` API methods to `brick[ns].*`.  
5. Calls `init()`.  
6. Registers all `events` handlers with the event bus (with phase + priority).

---

## Contracts & Conventions

To keep sanity in a loosely coupled system, VanillaBrick enforces these strict rules:

### 1. Event Naming Contract
Events **MUST** follow the 3-segment format: `namespace:type:target`.

| Segment     | Description | Rules |
|------------|-------------|-------|
| **Namespace** | The domain/owner of the event. | Required. Lowercase. No `*`. |
| **Type**      | The verb or action type. | Required. Lowercase. No `*`. |
| **Target**    | The specific instance or subject. | Required. No `*` (in dispatch). Wildcards allowed in listeners only. |

**Invalid:** `my:event` (too short), `grid:cell:click:row:1` (too long).
**Valid:** `grid:click:cell-1`.

### 2. Reserved Events
| Event | When |
|-------|------|
| `brick:status:ready` | Fired when the brick transitions to 'ready' state (fully initialized and extensions are applied). |
| `brick:status:destroyed` | Fired when the brick transitions to 'destroyed' state (just before the brick is dismantled). |

### 3. Lifecycle Phases
Every event flows through 3 phases. Extensions should choose the right one:
1. **`before`**: Validation, cancellation (`ev.cancel = true`), or data preparation.
2. **`on`**: The core action. Skipped if canceled.
3. **`after`**: Cleanup, logging, or UI updates reacting to the change.

---

## Current extensions (alpha)

This list will change, but right now you'll find things like:

- `dom` - resolve the main DOM element for a brick and manage DOM event listeners.  
- `domCss` - tiny helper layer: `brick.css.addClass`, `removeClass`, `show`, `hide`, `setStyle`, etc.  
- `domEvents` - maps native DOM events to VanillaBrick events (click, mouseover, etc.).  
- `store` - basic in-memory data store for grids / forms (`store.data:*` events).  
- `grid` - base grid behavior.  
- `columns` - grid header rendering + sorting logic.  
- `rows` - grid body rendering on `brick:status:ready` and when data changes.  

---

## Service bricks & Nexus (planned)

Bricks can also be used as **services**: no DOM, only state + events + extensions.
The idea is to build higher-level bricks that coordinate other bricks:

- master / detail wiring,
- shared stores between multiple grids,
- sync between forms and grids, etc.

A planned example is a `Nexus` service that links bricks automatically based on
IDs and roles (e.g. a `master` grid and several `slave` views), configured with
simple options such as:

```js
// sketch of a future Nexus-style link
grid.options.set('nexus.links', [
  { id: 0, kind: 'master' },
  { id: 2, source: 0, kind: 'slave' }
]);
```

This is not implemented yet, but the current architecture (bricks + extensions + events)
is designed with this kind of service in mind.

---

## Roadmap

> Heads-up: **Technical Deep Dive:** For a detailed breakdown of architectural decisions, performance optimizations (like Zero-Bind or Batching), and future core features, see [ROADMAP.md](./ROADMAP.md).

Short-term ideas:

- Clean up / split the monolithic `dist/VanillaBrick.js` into smaller `src/*` modules.
- Finish and document a stable **data store** API (remote / local data, paging hooks).
- Add a simple **form** brick type reusing the same event / extension model.
- Introduce the first **service bricks** (Nexus-style master/detail wiring).
- More demos:
  - master/detail with two grids bound by a service brick,
  - form + grid linked via a shared store.

Non-goals (for now):

- No JSX / virtual DOM.
- No mandatory build step to *use* VanillaBrick (only to develop it).
- No heavy theming engine -- CSS classes + small helpers should be enough.

---

## Contributing / playing with it

Right now this is mostly a personal playground, but issues and suggestions are welcome.

- Look at `/demos` for small examples.
- Open `dist/VanillaBrick.js` if you want to see how the runtime works.
- New extensions are the best way to experiment:
  - pick a `kind`,
  - declare `for` / `requires` / `ns`,
  - wire into events and expose a small public API.

---

## License

MIT -- see [LICENSE](./LICENSE) for details.
