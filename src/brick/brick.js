/**
 * Brick constructor.
 * @constructor
 * @param {Object} options
 */
export default function Brick(options) {
  const opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
  opts.id = opts.id || this._nextId();
  opts.host = (opts.host || 'brick').toLowerCase();
  opts.kind = (opts.kind || 'brick').toLowerCase();
  Object.defineProperty(this, 'id', {
    value: opts.id,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, 'host', {
    value: opts.host,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, 'kind', {
    value: opts.kind,
    writable: false,
    configurable: false,
    enumerable: true
  });

  // Per-brick runtime state container (isolated from public surface)
  Object.defineProperty(this, '_runtime', {
    value: {},
    writable: false,
    configurable: false,
    enumerable: false
  });

  // Reference to global controllers via _controllers object
  // We keep it as an object for potential future per-brick overrides or state containment
  Object.defineProperty(this, '_controllers', {
    value: globalThis.VanillaBrick.runtime.controllers,
    writable: false,
    configurable: false,
    enumerable: false
  });

  // Initialize controllers with this brick instance
  const brick = this;
  const ctrl = this._controllers;

  // Create per-brick state containers if not handled individually by init()
  // Note: ExtensionsController.init and others handle their own property creation on 'brick'

  // 1. Init Controllers
  if (ctrl.status) ctrl.status.init(brick);
  if (ctrl.options) ctrl.options.init(brick, opts);
  if (ctrl.events) ctrl.events.init(brick);
  if (ctrl.extensions) ctrl.extensions.init(brick);

  // 2. Create Public API Wrappers
  // These delegate to the global controllers passing 'brick' as context

  this.status = {
    get: () => ctrl.status.get(brick),
    set: (status, payload) => ctrl.status.set(brick, status, payload),
    is: (status) => ctrl.status.is(brick, status)
  };

  this.options = {
    get: (key, fallback) => ctrl.options.get(brick, key, fallback),
    set: (key, value) => {
      ctrl.options.setSync(brick, key, value);
      return brick;
    },
    setAsync: async (key, value) => {
      await ctrl.options.setAsync(brick, key, value);
      return brick;
    },
    has: (key) => ctrl.options.has(brick, key),
    all: () => ctrl.options.all(brick),
    setSilent: (key, value) => {
      ctrl.options.setSilent(brick, key, value);
      return brick;
    }
  };

  // The 'events' API is created inside events.init(brick) usually, 
  // but let's ensure it's there or delegate if not created.
  // Our EventsController.init DOES create brick.events, so we don't need to do it here manually
  // unless we want to be explicit. Let's trust init() for events as it sets up complex logic.

  // 3. Apply Extensions
  // This triggers the whole extension loading pipeline
  if (ctrl.extensions) {
    ctrl.extensions.applyAll(brick);
  }

  // 4. Set Initial Status
  if (ctrl.status) {
    ctrl.status.set(brick, 'ready', { options: opts });
  }
}

Brick.prototype.destroy = function () {
  this._controllers.status.set(this, 'destroyed');
  // Optional: clear runtime state to release references eagerly
  if (this._runtime) {
    this._runtime.status = {};
    this._runtime.options = {};
    this._runtime.events = {};
    this._runtime.extensions = {};
  }
};

Object.defineProperty(Brick, '_idCounter', {
  value: 0,
  writable: true,
  configurable: false,
  enumerable: false
});

Object.defineProperty(Brick.prototype, '_nextId', {
  value: function () {
    Brick._idCounter += 1;
    return 'brick-' + Brick._idCounter;
  },
  writable: false,
  configurable: false,
  enumerable: false
});
