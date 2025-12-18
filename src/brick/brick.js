import StatusController from '../controllers/statusController.js';
import RuntimeController from '../controllers/runtimeController.js';
import OptionsController from '../controllers/optionsController.js';
import EventBusController from '../controllers/eventsController.js';
import ExtensionsController from '../controllers/extensionsController.js';

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
  const controllers = Object.freeze({
    status: new StatusController(this),
    runtime: new RuntimeController(this),
    options: new OptionsController(this, opts),
    events: new EventBusController(this),
    extensions: new ExtensionsController(this),
  });
  Object.defineProperty(this, '_controllers', {
    value: controllers,
    writable: false,
    configurable: false,
    enumerable: false
  });

  controllers.extensions.applyAll();
  controllers.status.set('ready', { options: opts });
}

Brick.prototype.destroy = function () {
  this._controllers.status.set('destroyed');
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
