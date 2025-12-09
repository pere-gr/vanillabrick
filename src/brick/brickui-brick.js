;(function (BrickUI) {
  let idCounter = 0;
  function nextId() {
    idCounter += 1;
    return 'brick-' + idCounter;
  }

  /**
   * Brick constructor.
   * @constructor
   * @param {Object} options
   */
  function Brick(options) {
    const opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
    opts.id = opts.id || nextId();
    opts.kind = (opts.kind || 'brick').toLowerCase();
    this.id = opts.id;
    this.kind = opts.kind;
    this._controllers = Object.freeze({
      options: new BrickUI.controllers.options(this,opts),
      events: new BrickUI.controllers.events(this),
      extensions: new BrickUI.controllers.extensions(this),
    });

    this._controllers.extensions.applyAll();
    this._controllers.events.fireAsync('brick:ready:*', { options: opts });
  }

  Brick.prototype.destroy = function () {
    this._controllers.events.fire('brick:destroy:*', {});
  };

  BrickUI.brick = Brick;
})(window.BrickUI);
