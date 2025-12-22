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

  // 1. Init Controllers
  if (ctrl.status) ctrl.status.init(brick);
  if (ctrl.options) ctrl.options.init(brick, opts);
  if (ctrl.events) ctrl.events.init(brick);
  if (ctrl.extensions) ctrl.extensions.init(brick);

  // 2. Apply Extensions
  // This triggers the whole extension loading pipeline
  if (ctrl.extensions) {
    ctrl.extensions.applyAll(brick);
  }

  // 3. Set Initial Status
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
