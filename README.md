# BrickUI

BrickUI is an experimental **vanilla-JavaScript UI micro-framework** built around “bricks”:
small, self-contained components (grids, forms, etc.) wired together by a powerful event bus
and an extensible plugin system.

> **Status:** early alpha – architecture is still moving, APIs will break.  
> **Goal:** a real playground for enterprise-style components (grids/forms) with
> strong lifecycle and events, but **zero runtime dependencies** and a **single JS file**.

---

## Why BrickUI?

Most component libraries give you lots of widgets but very little control over what happens
**before** and **after** something changes. You usually get a single callback (`onChange`),
often at the wrong time, and then you’re fighting the framework.

BrickUI is an experiment to flip that around:

- Every interesting thing is an **event** with 3 phases: `before` → `on` → `after`.
- Events are named like `namespace:action:target` and can use wildcards.
- Extensions subscribe to those events and can **cancel**, **modify**, or **react** to them.
- Components stay small and composable; “magic” lives in extensions.

All of this runs on plain JS – no bundler required to *use* it.

---

## Features (current snapshot)

- **Vanilla JS only**  
  Single runtime file: `dist/brickui.js`. No React, no jQuery, no external deps.

- **Bricks**  
  Each brick has:
  - an `id` and a `kind` (e.g. `grid`, `form`),
  - an **options controller** (`brick.options.*`),
  - an **event bus controller** (`brick.events.*`),
  - an **extensions controller** that installs plugins based on `for` / `requires`.

- **Event bus with phases**  
  - Event names like `brick:ready:grid1`, `store:data:set`, `store:data:sort`, …  
  - 3 phases: `before`, `on`, `after`.  
  - Synchronous `fire()` and async `fireAsync()`.

- **Extension system**  
  - Extensions declare:
    - `for`: which brick kinds they apply to.
    - `requires`: which brick namespaces must exist (`dom`, `store`, …).
    - `ns`: namespace where their public API will live on the brick.
    - `brick`: methods exported to `brick[ns].*` (public API).
    - `extension`: internal helpers (`this` is the extension instance).
    - `events`: subscriptions to the event bus (`before` / `on` / `after`).
    - `options`: default options merged into the brick.
    - `init` / `destroy`: lifecycle hooks.

- **Auto-bootstrap from the DOM**  
  Any element with `class="bui"` becomes a brick; the `kind` is read from
  `brick-kind`, `data-kind` or `data-brick-kind`. The `dom` extension is wired
  automatically with the element as the brick’s root.

- **Grid demo** [(work in progress)](https://pere-gr.github.io/brickui/)  
  - `grid` brick kind.  
  - `columns` extension: header rendering + sorting.  
  - `rows` extension: body rendering.  
  - `store` extension: in-memory data with `store.data:*` events.  
  - Click on a sortable header → raises `store:data:sort` → rows re-render.

---

## Quick start

Clone the repo and open the demo HTML file:

```bash
git clone https://github.com/pere-gr/brickui.git
cd brickui
# open index.html in a browser
```

Minimal example (adapted from the demo):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>BrickUI demo</title>

  <!-- Demo styles only -->
  <link rel="stylesheet" href="./demos/demo.css" />

  <!-- BrickUI runtime -->
  <script defer src="./dist/brickui.js"></script>
  <!-- Optional: your own script (to set options, etc.) -->
  <script defer src="./demos/demo.js"></script>
</head>
<body>
  <h1>BrickUI demo</h1>

  <table id="grid1" class="bui bui-grid" brick-kind="grid">
    <thead></thead>
    <tbody></tbody>
  </table>
</body>
</html>
```

When the DOM is ready, BrickUI automatically:

1. Finds `.bui` elements.
2. Creates a `BrickUI.brick` for each one.
3. Applies all matching extensions (dom, store, grid, columns, rows, …).
4. Fires `brick:ready:*`.

You can then grab the instance from JS:

```js
const grid = BrickUI.base.getBrick('grid1');
grid.columns.sort('code');        // triggers a store:data:sort event
grid.store.set(newRowsArray);     // triggers store:data:set + re-render
```

---

## Core concepts

### Bricks

```js
const grid = new BrickUI.brick({
  id: 'grid1',
  kind: 'grid',
  dom: { id: 'grid1' }
});
```

Each brick:

- stores options via the **options controller**,
- handles events via the **event bus controller**,
- gets extensions installed via the **extensions controller**.

Internally, controllers live under `brick._controllers`, but each exposes a small public API
on the brick:

- `brick.options.get(...)`, `set(...)`, `all()`, …  
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

Extensions can provide default options (they’re applied silently during install).

### Event bus

Event names are strings in the form:

```text
namespace:action:target
```

Examples:

- `brick:ready:grid1`
- `store:data:set`
- `store:data:sort`
- `dom:click:*`

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
BrickUI.extensions.columns = {
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
      for: 'brick:ready:*',
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

## Current extensions (alpha)

This list will change, but right now you’ll find things like:

- `dom` – resolve the main DOM element for a brick and manage DOM event listeners.  
- `domCss` – tiny helper layer: `brick.css.addClass`, `removeClass`, `show`, `hide`, `setStyle`, …  
- `domEvents` – maps native DOM events to BrickUI events (click, mouseover, etc.).  
- `store` – basic in-memory data store for grids / forms (`store.data:*` events).  
- `grid` – base grid behavior.  
- `columns` – grid header rendering + sorting logic.  
- `rows` – grid body rendering on `brick:ready` and when data changes.  

---

## Roadmap

Short-term ideas:

- Clean up / split the monolithic `dist/brickui.js` into smaller `src/*` modules.
- Finish and document a stable **data store** API (remote / local data, paging hooks).
- Add a simple **form** brick type reusing the same event / extension model.
- More demos:
  - master/detail with two grids bound by events,
  - form + grid linked via a shared store.

Non-goals (for now):

- No JSX / virtual DOM.
- No mandatory build step to *use* BrickUI (only to develop it).
- No heavy theming engine – CSS classes + small helpers should be enough.

---

## Contributing / playing with it

Right now this is mostly a personal playground, but issues and suggestions are welcome.

- Look at `/demos` for small examples.
- Open `dist/brickui.js` if you want to see how the runtime works.
- New extensions are the best way to experiment:
  - pick a `kind`,
  - declare `for` / `requires` / `ns`,
  - wire into events and expose a small public API.

---

## License

MIT – see [LICENSE](./LICENSE) for details.
