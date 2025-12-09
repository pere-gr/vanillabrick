;(function (BrickUI) {
  /**
   * Per-brick options controller.
   * Guarda un objecte pla i ofereix get/set/has/all.
   * @constructor
   * @param {Object} brick
   * @param {Object} initial
   */
  function OptionsController(brick, initial) {
    this.brick = brick;
    this.data = {};
    this._eventsBound = false;

    if (initial && typeof initial === 'object') {
      for (const k in initial) {
        if (Object.prototype.hasOwnProperty.call(initial, k)) {
          this.data[k] = initial[k];
        }
      }
    }

    var ctrl = this;

    // API pública al brick
    brick.options = {
      get: function (key, fallback) {
        return ctrl.get(key, fallback);
      },

      // Async: sempre passa pel eventBus (fireAsync)
      set: async function (key, value) {
        await ctrl.set(key, value);
        return brick; // permet await brick.options.set(...); i chaining
      },

      has: function (key) {
        return ctrl.has(key);
      },

      all: function () {
        return ctrl.all();
      }
    };
  }

  /**
   * Registra el handler _apply al bus d'events
   * per a la fase "on" de "options:value:*".
   * Només es fa un cop.
   */
  OptionsController.prototype._ensureEventsBinding = function () {
    if (this._eventsBound) return;

    var brick = this.brick;
    var self = this;

    // Confies en la arquitectura: brick.events i on() EXISTEIXEN.
    brick.events.on('options:value:*', 'on', 5, function (ev) {
      self._apply(ev);
    });

    this._eventsBound = true;
  };

  /**
   * Handler de fase "on" per "options:value:*".
   * Aplica els canvis a this.data a partir de ev.data.
   *
   * Shape assumit:
   *  - single: { key, value, previous, options, brick }
   *  - batch:  { batch:true, values:{...}, previous:{...}, options, brick }
   *
   * @param {Object} ev - event del EventBus
   */
  OptionsController.prototype._apply = function (ev) {
    if (!ev) return;
    var payload = ev.data || {};

    // Batch: set({ a:1, b:2 })
    if (payload.batch && payload.values && typeof payload.values === 'object') {
      for (var k in payload.values) {
        if (Object.prototype.hasOwnProperty.call(payload.values, k)) {
          this.data[k] = payload.values[k];
        }
      }
      return;
    }

    // Single: set('foo', 123)
    if (typeof payload.key === 'string') {
      this.data[payload.key] = payload.value;
    }
  };

  /**
   * Set a value or merge an object, disparant events options:value.
   * Sempre usa fireAsync per permetre handlers async.
   *
   * @param {string|Object} key
   * @param {any} value
   * @returns {Promise<OptionsController>}
   */
  OptionsController.prototype.set = async function (key, value) {
    this._ensureEventsBinding();

    var brick = this.brick;

    // OBJECTE: set({ a:1, b:2 })
    if (key && typeof key === 'object' && !Array.isArray(key)) {
      var values = {};
      var previous = {};

      for (var k in key) {
        if (!Object.prototype.hasOwnProperty.call(key, k)) continue;
        values[k] = key[k];
        previous[k] = Object.prototype.hasOwnProperty.call(this.data, k)
          ? this.data[k]
          : undefined;
      }

      var batchPayload = {
        batch: true,
        values: values,
        previous: previous,
        options: this,
        brick: brick
      };

      // sense target: "options:value:"
      await brick.events.fireAsync('options:value:', batchPayload);
      return this;
    }

    // SINGLE: set('theme', 'dark')
    var oldValue = Object.prototype.hasOwnProperty.call(this.data, key)
      ? this.data[key]
      : undefined;

    var payload = {
      key: key,
      value: value,
      previous: oldValue,
      options: this,
      brick: brick
    };

    // amb target: "options:value:<key>"
    await brick.events.fireAsync('options:value:' + key, payload);
    return this;
  };

  /**
   * Get a value by key or return fallback.
   * @param {string} key
   * @param {any} fallback
   * @returns {any}
   */
  OptionsController.prototype.get = function (key, fallback) {
    if (Object.prototype.hasOwnProperty.call(this.data, key)) {
      return this.data[key];
    }
    return fallback;
  };

  /**
   * Indica si la clau existeix.
   * @param {string} key
   * @returns {boolean}
   */
  OptionsController.prototype.has = function (key) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  };

  /**
   * Retorna una còpia superficial de totes les opcions.
   * @returns {Object}
   */
  OptionsController.prototype.all = function () {
    return Object.assign({}, this.data);
  };

  BrickUI.controllers = BrickUI.controllers || {};
  BrickUI.controllers.options = OptionsController;
})(window.BrickUI);
