;(function (global) {
  if (global.BrickUI) return;
  global.BrickUI = {
    base: {},
    controllers: {},
    brick: null,
    extensions: {},
    services: null,
  };
})(typeof window !== 'undefined' ? window : this);

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

;(function (BrickUI) {
  /**
   * Per-brick event bus controller.
   * Manages events shaped as "namespace:event:target" with phases before/on/after.
   * @constructor
   */
function EventBusController(brick) {
  this.brick = brick || null;
  this.handlers = []; // { pattern, compiled, phase, priority, handler }
  this.phases = ['before', 'on', 'after'];

  // Expose public EventBus API on the brick
  var bus = this;
  if (brick) {
    brick.events = {
      on: function (pattern, phase, priority, handler) {
        bus.on(pattern, phase, priority, handler);
        return brick; // permet chaining
      },
      off: function (pattern, phase, handler) {
        bus.off(pattern, phase, handler);
        return brick;
      },
      fire: function (eventName, payload) {
        bus.fire(eventName, payload);
        return brick;
      },
      fireAsync: function (eventName, payload) {
        return bus.fireAsync(eventName, payload);
      }
    };
  }
}

  // ---------- Internal utils ----------

  EventBusController.prototype._normalizePriority = function (priority) {
    let pr = typeof priority === 'number' ? priority : 5;
    if (pr < 0) pr = 0;
    if (pr > 10) pr = 10;
    return pr;
  };

  // pattern: "ns:event:target" with '*' as wildcard
  EventBusController.prototype._compilePattern = function (pattern) {
    const parts = (pattern || '').split(':');
    const ns = parts[0] || '*';
    const ev = parts[1] || '*';
    const target = parts[2];

    return {
      namespace: ns === '*' ? undefined : ns,
      event: ev === '*' ? undefined : ev,
      target: !target || target === '*' ? undefined : target,
    };
  };

  // eventName: "ns:event:target"
  EventBusController.prototype._parseEventKey = function (eventName) {
    const parts = (eventName || '').split(':');
    return {
      namespace: parts[0] || '',
      event: parts[1] || '',
      target: parts[2] || null,
    };
  };

  EventBusController.prototype._matches = function (compiled, key) {
    return (
      (compiled.namespace === undefined || compiled.namespace === key.namespace) &&
      (compiled.event === undefined || compiled.event === key.event) &&
      (compiled.target === undefined || compiled.target === key.target)
    );
  };

  // ---------- Subscription API ----------

  /**
   * Register a handler for a pattern and phase.
   * pattern: "ns:event:target" (supports '*')
   * phase: "before" | "on" | "after" (default "on")
   * priority: 0..10 (default 5, 0 = highest priority)
   */
  EventBusController.prototype.on = function (pattern, phase, priority, handler) {
    if (typeof handler !== 'function') return;

    let ph = phase || 'on';
    if (this.phases.indexOf(ph) === -1) ph = 'on';

    const pr = this._normalizePriority(priority);

    this.handlers.push({
      pattern: pattern,
      compiled: this._compilePattern(pattern),
      phase: ph,
      handler: handler,
      priority: pr,
    });

    // Sort by priority asc (0 = first)
    this.handlers.sort(function (a, b) {
      const pa = typeof a.priority === 'number' ? a.priority : 5;
      const pb = typeof b.priority === 'number' ? b.priority : 5;
      return pa - pb;
    });
  };

  /**
   * Unregister handlers filtered by pattern, phase and/or handler.
   */
  EventBusController.prototype.off = function (pattern, phase, handler) {
    for (let i = this.handlers.length - 1; i >= 0; i -= 1) {
      const h = this.handlers[i];
      if (pattern && h.pattern !== pattern) continue;
      if (phase && h.phase !== phase) continue;
      if (handler && h.handler !== handler) continue;
      this.handlers.splice(i, 1);
    }
  };

  // ---------- Pipeline execution (async core) ----------

  EventBusController.prototype._run = async function (eventName, payload) {
    const key = this._parseEventKey(eventName);
    const phases = this.phases;

    // Event object shared across phases
    const ev = {
      name: eventName, // "ns:event:target"
      namespace: key.namespace,
      event: key.event,
      target: key.target,

      phase: null, // "before" | "on" | "after"
      data: payload,
      brick: this.brick || null,

      cancel: false, // if true, skip "on" phase
      stopPhase: false, // if true, stop the current phase loop
      errors: [], // collected handler errors
      meta: {}, // free metadata bag
    };

    for (let p = 0; p < phases.length; p += 1) {
      const phase = phases[p];

      // if canceled, skip "on" phase but still run others
      if (phase === 'on' && ev.cancel) continue;

      ev.phase = phase;

      for (let i = 0; i < this.handlers.length; i += 1) {
        const h = this.handlers[i];

        if (h.phase !== phase) continue;
        if (!this._matches(h.compiled, key)) continue;
        if (ev.stopPhase) break;

        try {
          const r = h.handler(ev, { brick: this.brick });
          if (r && typeof r.then === 'function') {
            await r; // support async handlers
          }
        } catch (err) {
          ev.errors.push(err);
          // on handler error, force cancel
          ev.cancel = true;
        }
      }
    }

    return ev;
  };

  // ---------- Public API ----------

  /**
   * Fire-and-forget event.
   * eventName: "ns:event:target"
   */
  EventBusController.prototype.fire = function (eventName, payload) {
    // Fire-and-forget; use fireAsync() if you need the final event object.
    this._run(eventName, payload);
  };

  /**
   * Fire an event and get a Promise with the final event object
   * (to inspect cancel/errors/meta).
   */
  EventBusController.prototype.fireAsync = function (eventName, payload) {
    return this._run(eventName, payload);
  };

  // ---------- Hook to global namespace ----------

  BrickUI.controllers = BrickUI.controllers || {};
  BrickUI.controllers.events = EventBusController;
})(window.BrickUI);

;(function (BrickUI) {
  // Assegurem BrickUI global
  BrickUI = BrickUI || (window.BrickUI = window.BrickUI || {});

  // Diccionari de definicions d'extensions:
  //   BrickUI.extensions.myExt = { _name: "myExt", ... }
  BrickUI.extensions = BrickUI.extensions || {};

  // Petit helper de registre/base
  // (ara mateix només serveix per obtenir totes les definicions)
  BrickUI.controllers.extensionsRegistry = BrickUI.controllers.extensionsRegistry || {
    /**
     * Retorna un array amb totes les definicions d'extensions
     * definides a BrickUI.extensions.*
     */
    all: function () {
      const list = [];
      const src = BrickUI.extensions || {};
      for (const key in src) {
        if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
        const def = src[key];
        if (!def || typeof def !== 'object') continue;

        // Si no té _name, fem servir la clau
        if (!def._name) def._name = key;

        list.push(def);
      }
      return list;
    }
  };
})(window.BrickUI);

;(function (BrickUI) {
  // Assegurem BrickUI i contenidor de controllers
  BrickUI = BrickUI || (window.BrickUI = window.BrickUI || {});
  BrickUI.controllers = BrickUI.controllers || {};

  /**
   * Comprova si una extensio aplica al tipus de Brick actual
   * _for: '*', 'form', ['form','grid'], ...
   */
  function matchesFor(def, brick) {
    if (!def) return false;
    const rule = def._for;
    if (!rule) return true;                 // per defecte, aplica a tot
    if (rule === '*') return true;
    if (typeof rule === 'string') return rule === brick.kind;
    if (Array.isArray(rule)) return rule.indexOf(brick.kind) !== -1;
    return false;
  }

  /**
   * Comprova requeriments de namespaces:
   * _requires: ['data','dom', ...] -> brick['data'], brick['dom'], ...
   * (options, events sempre hi son via controllers)
   */
  function requiresMet(def, brick) {
    const reqs = def._requires;
    if (!reqs || !reqs.length) return true;
    for (let i = 0; i < reqs.length; i += 1) {
      const ns = reqs[i];
      if (!brick[ns]) return false;
    }
    return true;
  }

  /**
   * "field:value:*" -> { ns: 'field', action: 'value', target: '*' }
   */
  function parseForPattern(pattern) {
    if (!pattern) return { ns: '', action: '', target: '*' };
    const bits = String(pattern).split(':');
    const ns = bits[0] || '';
    const action = bits[1] || '';
    let target = bits.length > 2 ? bits.slice(2).join(':') : '*';
    if (!target) target = '*';
    return { ns: ns, action: action, target: target };
  }

  /**
   * Controller d'extensions per Brick
   * @constructor
   * @param {any} brick
   */
  function ExtensionsController(brick) {
    this.brick = brick;
    this.extensions = {};    // map _name -> instancia { name, def, data, ... }
    this._destroyHook = false;
  }

  /**
   * Aplica totes les extensions definides a BrickUI.extensions.*
   * respectant _for i _requires
   */
  ExtensionsController.prototype.applyAll = function () {
    const registry = BrickUI.controllers.extensionsRegistry;
    if (!registry || typeof registry.all !== 'function') return;

    const defs = registry.all() || [];
    if (!defs.length) return;

    const pending = defs.slice();
    let loops = 0;
    const maxLoops = 20;

    while (pending.length && loops < maxLoops) {
      loops += 1;
      let progressed = false;

      for (let i = pending.length - 1; i >= 0; i -= 1) {
        const def = pending[i];
        if (!def) {
          pending.splice(i, 1);
          progressed = true;
          continue;
        }

        // No aplica a aquest brick
        if (!matchesFor(def, this.brick)) {
          pending.splice(i, 1);
          progressed = true;
          continue;
        }

        // Encara no es compleixen els _requires (ns d'altres extensions)
        if (!requiresMet(def, this.brick)) continue;

        // Instal?lar
        this._install(def);
        pending.splice(i, 1);
        progressed = true;
      }

      if (!progressed) break;
    }

    if (pending.length) {
      console.warn(
        'BrickUI extensions not installed due to unmet requirements',
        pending
      );
    }

    this._ensureDestroyHook();
  };

  /**
   * Instal?la una unica extensio sobre el Brick.
   * - Crea instancia "ext" amb funcions _private i data = {}
   * - Exposa l'API (_api) al brick[_ns]
   * - Registra els listeners (_listeners)
   */
  ExtensionsController.prototype._install = function (def) {
    const brick = this.brick;
    const name = def._name || '';

    if (!name) {
      console.warn('BrickUI extension without _name, skipped', def);
      return;
    }

    if (this.extensions[name]) {
      // ja instal?lada en aquest brick
      return;
    }

    // Instancia d'extensio per aquest brick (referencia la definicio)
    const ext = {
      name: name,
      def: def,
      data: {},
    };

    // init() opcional a la definicio: this = brick, primer arg = ext
    if (typeof def.init === 'function') {
      try {
        const initResult = def.init.call(brick, ext);
        if (initResult === false) {
          return; // no instal?lar si init retorna false
        }
      } catch (err) {
        console.error(
          'BrickUI extension "' + name + '" init() failed',
          err
        );
        return;
      }
    }

    // Funcions privades (_private): les enganxem directament a ext
    if (Array.isArray(def._private)) {
      for (let pi = 0; pi < def._private.length; pi += 1) {
        const privName = def._private[pi];
        const privFn = def[privName];
        if (typeof privFn !== 'function') {
          console.warn(
            'BrickUI extension "' + name + '" private "' + privName + '" is not a function'
          );
          continue;
        }
        // ext.myFn2(...) -> def.myFn2.call(brick, ext, ...)
        ext[privName] = privFn.bind(brick, ext);
      }
    }

    // Opcions per defecte cap al controlador d'opcions (si existeix)
    if (def._options &&
        brick._controllers &&
        brick._controllers.options &&
        typeof brick._controllers.options.set === 'function') {
      brick._controllers.options.set(def._options);
    }

    // Exposar API (_api) al namespace del brick (_ns)
    if (def._ns && Array.isArray(def._api) && def._api.length) {
      if (!brick[def._ns]) {
        brick[def._ns] = {};
      }
      const nsObj = brick[def._ns];

      for (let ai = 0; ai < def._api.length; ai += 1) {
        const apiName = def._api[ai];
        const apiFn = def[apiName];

        if (typeof apiFn !== 'function') {
          console.warn(
            'BrickUI extension "' + name + '" api "' + apiName + '" is not a function'
          );
          continue;
        }

        if (nsObj[apiName]) {
          console.warn(
            'BrickUI extension overwriting API ' + def._ns + '.' + apiName
          );
        }

        // brick.whatever.myfn1(...) -> def.myfn1.call(brick, ext, ...)
        nsObj[apiName] = apiFn.bind(brick, ext);
      }
    }

    // Registrar listeners (_listeners) sobre el bus d'events
    if (Array.isArray(def._listeners) &&
        def._listeners.length &&
        brick._controllers &&
        brick._controllers.events &&
        typeof brick._controllers.events.on === 'function') {

      for (let li = 0; li < def._listeners.length; li += 1) {
        const listener = def._listeners[li];
        if (!listener) continue;

        const parsed = parseForPattern(listener.for);
        const handlersList = listener.handlers || [];

        for (let hi = 0; hi < handlersList.length; hi += 1) {
          const hdesc = handlersList[hi];
          if (!hdesc) continue;

          const phase = hdesc.phase || 'on';
          const fnName = hdesc.fn;
          const pr = (typeof hdesc.priority === 'number') ? hdesc.priority : undefined;

          const handlerFn = def[fnName];
          if (typeof handlerFn !== 'function') {
            console.warn(
              'BrickUI extension "' + name + '" handler "' + fnName + '" is not a function'
            );
            continue;
          }

          const pattern = parsed.ns + ':' + parsed.action + ':' + parsed.target;

          // Quan l'event salta, es crida def[fnName].call(brick, ext, eventData)
          const wrapped = handlerFn.bind(brick, ext);

          brick._controllers.events.on(pattern, phase, pr, wrapped);
        }
      }
    }

    // Guardem la instancia perque l'extensio tingui estat per-brick
    this.extensions[name] = ext;
  };

  /**
   * Registra un hook per destruir extensions quan el brick es destrueix.
   * Basat en un event "brick:destroy:*" (fase 'on') al bus d'events.
   */
  ExtensionsController.prototype._ensureDestroyHook = function () {
    if (this._destroyHook) return;

    const brick = this.brick;
    if (!brick ||
        !brick.controllers ||
        !brick.controllers.events ||
        typeof brick.controllers.events.on !== 'function') {
      return;
    }

    this._destroyHook = true;
    const self = this;

    brick.controllers.events.on(
      'brick:destroy:*',
      'on',
      0,
      function () {
        let name;
        for (name in self.extensions) {
          if (!Object.prototype.hasOwnProperty.call(self.extensions, name)) continue;
          const ext = self.extensions[name];
          if (!ext || !ext.def) continue;
          const def = ext.def;

          if (typeof def.destroy === 'function') {
            try {
              // destroy(ext) amb this === brick
              def.destroy.call(brick, ext);
            } catch (err) {
              console.error(
                'BrickUI extension "' + (def._name || name || '?') + '" destroy() failed',
                err
              );
            }
          }
        }

        self.extensions = {};
      }
    );
  };

  // Exposem el controller al namespace de BrickUI
  BrickUI.controllers.extensions = ExtensionsController;
})(window.BrickUI);

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

;(function (BrickUI) {
  BrickUI = BrickUI || (window.BrickUI = window.BrickUI || {});
  BrickUI.extensions = BrickUI.extensions || {};

  function resolveElement(value) {
    if (!value) return null;
    if (typeof Element !== 'undefined' && value instanceof Element) return value;
    if (value && value.nodeType === 1) return value;
    if (typeof value === 'function') {
      try {
        return value();
      } catch (err) {
        return null;
      }
    }
    return null;
  }

  function resolveById(id) {
    if (!id || typeof id !== 'string') return null;
    if (typeof document === 'undefined') return null;
    return document.getElementById(id) || null;
  }

  BrickUI.extensions.dom = {
    _name: 'dom',
    _for: '*',
    _ns: 'dom',
    _api: ['getElement', 'on', 'off'],
    _listeners: [
      { for: 'brick:ready:*', handlers: [{ phase: 'on', fn: 'onReady' }] },
      { for: 'brick:destroy:*', handlers: [{ phase: 'before', fn: 'onDestroy' }] },
    ],

    init: function (ext) {
      const hasOptions = this.options && typeof this.options.get === 'function';
      const elemOpt = hasOptions ? this.options.get('dom.element', null) : null;
      const idOpt = hasOptions ? this.options.get('dom.id', null) : null;

      let el = resolveElement(elemOpt);
      if (!el && idOpt) {
        el = resolveById(idOpt);
      }

      if (!el) {
        console.warn('BrickUI dom extension requires a DOM element (options.dom.element) or a valid options.dom.id', this.id);
        return false;
      }

      if (elemOpt && !resolveElement(elemOpt)) {
        console.warn('BrickUI dom element must be a DOM node or factory, not an id. Use options.dom.id to resolve by id.', this.id);
      }

      ext.data.element = el;
      ext.data.listeners = [];
    },

    getElement: function (ext) {
      return ext.data.element || null;
    },

    on: function (ext, type, handler, options) {
      const el = ext.data.element;
      if (!el || typeof el.addEventListener !== 'function' || typeof handler !== 'function') return;
      el.addEventListener(type, handler, options);
      ext.data.listeners.push({ type: type, handler: handler, options: options, source: 'api' });
    },

    off: function (ext, type, handler, options) {
      const el = ext.data.element;
      if (!el || typeof el.removeEventListener !== 'function' || typeof handler !== 'function') return;
      el.removeEventListener(type, handler, options);

      if (Array.isArray(ext.data.listeners)) {
        for (let i = ext.data.listeners.length - 1; i >= 0; i -= 1) {
          const ln = ext.data.listeners[i];
          if (ln.type === type && ln.handler === handler) {
            ext.data.listeners.splice(i, 1);
          }
        }
      }
    },

    onReady: function (ext) {
      const el = ext.data.element;
      if (!el || typeof el.addEventListener !== 'function') return;

      const brick = this;
      const defaultMap = [
        { type: 'click', eventName: 'dom:click:*' },
        { type: 'mouseenter', eventName: 'dom:hover:on' },
        { type: 'mouseleave', eventName: 'dom:hover:off' },
        { type: 'mousedown', eventName: 'dom:mouse:down' },
        { type: 'mouseup', eventName: 'dom:mouse:up' },
      ];

      for (let i = 0; i < defaultMap.length; i += 1) {
        const entry = defaultMap[i];
        const handler = function (domEvent) {
          brick.events.fire(entry.eventName, {
            domEvent: domEvent,
            element: el,
          });
        };
        el.addEventListener(entry.type, handler);
        ext.data.listeners.push({ type: entry.type, handler: handler, source: 'default' });
      }
    },

    onDestroy: function (ext) {
      const el = ext.data.element;
      if (!el || typeof el.removeEventListener !== 'function') return;

      const listeners = ext.data.listeners || [];
      for (let i = 0; i < listeners.length; i += 1) {
        const ln = listeners[i];
        el.removeEventListener(ln.type, ln.handler, ln.options);
      }

      ext.data.listeners = [];
    },
  };
})(window.BrickUI);
