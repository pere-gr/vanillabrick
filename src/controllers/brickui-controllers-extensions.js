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
