
/**
 * Brick constructor.
 * @constructor
 * @param {Object} options
 */
function Brick(options) {
  const opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
  opts.id = opts.id || this._nextId();
  opts.kind = (opts.kind || 'brick').toLowerCase();
  Object.defineProperty(this, 'id', {
    value: opts.id,
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
  const controllers = Object.freeze({
    runtime: new VanillaBrick.controllers.runtime(this),
    options: new VanillaBrick.controllers.options(this, opts),
    events: new VanillaBrick.controllers.events(this),
    extensions: new VanillaBrick.controllers.extensions(this),
  });
  Object.defineProperty(this, '_controllers', {
    value: controllers,
    writable: false,
    configurable: false,
    enumerable: false
  });

  controllers.extensions.applyAll();
  controllers.events.fireAsync('brick:ready:*', { options: opts });
}

Brick.prototype.destroy = function () {
  this._controllers.events.fire('brick:destroy:*', {});
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

VanillaBrick.brick = Brick;

