
/**
 * Per-brick options controller.
 * Guarda valors en objectes nested segons rutes amb punts,
 * mantenint compatibilitat de lectura amb claus planes.
 * @constructor
 * @param {Object} brick
 * @param {Object} initial
 */
function OptionsController(brick, initial) {
  this.brick = brick;
  this.data = {};
  this._cache = {}; // Cache for O(1) reads
  this._eventsBound = false;

  if (initial && typeof initial === 'object') {
    for (const k in initial) {
      if (Object.prototype.hasOwnProperty.call(initial, k)) {
        setPath(this.data, toPath(k), initial[k]);
      }
    }
  }

  var ctrl = this;

  // API pública al brick
  brick.options = {
    get: function (key, fallback) {
      return ctrl.get(key, fallback);
    },

    // Síncron: dispara events via fire()
    set: function (key, value) {
      ctrl.setSync(key, value);
      return brick;
    },

    // Async: dispara events via fireAsync()
    setAsync: async function (key, value) {
      await ctrl.setAsync(key, value);
      return brick; // permet await brick.options.setAsync(...); i chaining
    },

    has: function (key) {
      return ctrl.has(key);
    },

    all: function () {
      return ctrl.all();
    },

    setSilent: function (key, value) {
      ctrl.setSilent(key, value);
      return brick; // chaining
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

  // Invalidate cache on any update
  this._cache = {};

  // Batch: set({ a:1, b:2 }) / set({ dom:{id:'x'} })
  if (payload.batch && payload.values && typeof payload.values === 'object') {
    for (var k in payload.values) {
      if (Object.prototype.hasOwnProperty.call(payload.values, k)) {
        setPath(this.data, toPath(k), payload.values[k]);
      }
    }
    return;
  }

  // Single: set('foo', 123)
  if (typeof payload.key === 'string') {
    setPath(this.data, toPath(payload.key), payload.value);
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
OptionsController.prototype.setAsync = async function (key, value) {
  this._ensureEventsBinding();

  var brick = this.brick;

  // OBJECTE: set({ a:1, b:2 }) (pot incloure nested)
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    var values = {};
    var previous = {};

    flattenEntries(key, '', values);

    for (var vk in values) {
      if (!Object.prototype.hasOwnProperty.call(values, vk)) continue;
      previous[vk] = getWithFallback(this.data, vk);
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
  var oldValue = getWithFallback(this.data, key);

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
 * Set a value or merge an object, disparant events options:value de forma síncrona.
 * @param {string|Object} key
 * @param {any} value
 * @returns {OptionsController}
 */
OptionsController.prototype.setSync = function (key, value) {
  this._ensureEventsBinding();

  var brick = this.brick;

  // OBJECTE: set({ a:1, b:2 }) (pot incloure nested)
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    var values = {};
    var previous = {};

    flattenEntries(key, '', values);

    for (var vk in values) {
      if (!Object.prototype.hasOwnProperty.call(values, vk)) continue;
      previous[vk] = getWithFallback(this.data, vk);
    }

    var batchPayload = {
      batch: true,
      values: values,
      previous: previous,
      options: this,
      brick: brick
    };

    // sense target: "options:value:"
    brick.events.fire('options:value:', batchPayload);
    return this;
  }

  // SINGLE: set('theme', 'dark')
  var oldValue = getWithFallback(this.data, key);

  var payload = {
    key: key,
    value: value,
    previous: oldValue,
    options: this,
    brick: brick
  };

  // amb target: "options:value:<key>"
  brick.events.fire('options:value:' + key, payload);
  return this;
};

// Compat: alias set -> setAsync
OptionsController.prototype.set = OptionsController.prototype.setAsync;

/**
 * Set sense emetre events.
 * @param {string|Object} key
 * @param {any} value
 * @returns {OptionsController}
 */
OptionsController.prototype.setSilent = function (key, value) {
  // Invalidate cache
  this._cache = {};

  // OBJECTE: setSilent({ a:1, b:2 })
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    flattenEntries(key, '', this.data);
    return this;
  }

  // SINGLE: setSilent('foo', 123)
  setPath(this.data, toPath(key), value);
  return this;
};

/**
 * Get a value by key or return fallback.
 * @param {string} key
 * @param {any} fallback
 * @returns {any}
 */
OptionsController.prototype.get = function (key, fallback) {
  // 1. Return from cache if available
  if (Object.prototype.hasOwnProperty.call(this._cache, key)) {
    return this._cache[key];
  }

  // 2. Slow lookup
  var val = getWithFallback(this.data, key);
  var result = typeof val === 'undefined' ? fallback : val;

  // 3. Store in cache
  this._cache[key] = result;

  return result;
};

/**
 * Indica si la clau existeix.
 * @param {string} key
 * @returns {boolean}
 */
OptionsController.prototype.has = function (key) {
  var path = toPath(key);
  if (!path.length) return false;
  var nested = hasPath(this.data, path);
  if (nested) return true;
  // compatibilitat: clau plana
  return Object.prototype.hasOwnProperty.call(this.data, key);
};

/**
 * Retorna una còpia superficial de totes les opcions.
 * @returns {Object}
 */
OptionsController.prototype.all = function () {
  return Object.assign({}, this.data);
};

// Helpers per gestionar claus amb punts com a rutes nested
function toPath(key) {
  if (!key && key !== 0) return [];
  if (Array.isArray(key)) return key;
  return String(key)
    .split('.')
    .filter(function (p) { return p !== ''; });
}

function setPath(obj, path, value) {
  if (!path.length) return;
  var cur = obj;
  for (var i = 0; i < path.length - 1; i += 1) {
    var seg = path[i];
    if (!cur[seg] || typeof cur[seg] !== 'object') {
      cur[seg] = {};
    }
    cur = cur[seg];
  }
  cur[path[path.length - 1]] = value;
}

function getPath(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i += 1) {
    var seg = path[i];
    if (!cur || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return undefined;
    }
    cur = cur[seg];
  }
  return cur;
}

function hasPath(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i += 1) {
    var seg = path[i];
    if (!cur || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return false;
    }
    cur = cur[seg];
  }
  return true;
}

function getWithFallback(data, key) {
  var path = toPath(key);
  if (path.length) {
    var nested = getPath(data, path);
    if (typeof nested !== 'undefined') return nested;
  }
  // compatibilitat amb claus planes existents
  if (Object.prototype.hasOwnProperty.call(data, key)) {
    return data[key];
  }
  return undefined;
}

// Extreu claus de tipus objecte en forma de "a.b": valor
function flattenEntries(src, prefix, target) {
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var path = prefix ? prefix + '.' + k : k;
    var val = src[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenEntries(val, path, target);
    } else {
      target[path] = val;
    }
  }
}

VanillaBrick.controllers = VanillaBrick.controllers || {};
VanillaBrick.controllers.options = OptionsController;
