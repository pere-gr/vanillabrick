  function matchesFor(def, brick) {
    const rule = def.for || def._for;
    if (!rule) return true;
    if (rule === '*') return true;
    if (typeof rule === 'string') return rule === brick.kind;
    if (Array.isArray(rule)) return rule.indexOf(brick.kind) !== -1;
    return false;
  }

  function requiresMet(def, brick) {
    const reqs = def.requires || def._requires;
    if (!reqs || !reqs.length) return true;
    for (let i = 0; i < reqs.length; i += 1) {
      const ns = reqs[i];
      if (!brick[ns]) return false;
    }
    return true;
  }

  function parseForPattern(pattern) {
    if (!pattern) return { ns: '', action: '', target: '*' };
    const bits = String(pattern).split(':');
    const ns = bits[0] || '';
    const action = bits[1] || '';
    let target = bits.length > 2 ? bits.slice(2).join(':') : '*';
    if (!target) target = '*';
    return { ns: ns, action: action, target: target };
  }

  function ExtensionsController(brick) {
    this.brick = brick;
    this.extensions = {};
    this._destroyHook = false;
  }

  ExtensionsController.prototype.applyAll = function () {
    const registry = VanillaBrick.controllers.extensionsRegistry;
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

        if (!matchesFor(def.ext, this.brick)) {
          pending.splice(i, 1);
          progressed = true;
          continue;
        }

        if (!requiresMet(def.ext, this.brick)) continue;
        
        this._install(def);
        pending.splice(i, 1);
        progressed = true;
      }

      if (!progressed) break;
    }

    if (pending.length) {
      console.warn('VanillaBrick extensions not installed due to unmet requirements', pending);
    }

    this._ensureDestroyHook();
  };

  ExtensionsController.prototype._install = function (def) {
    const brick = this.brick;
    const name = def.name || def.ext.ns || null;
    const ns = def.ext.ns || name;

    if (!name) {
      console.warn('VanillaBrick extension without name/ns, skipped', def);
      return;
    }

    if (this.extensions[name]) return;

    const ext = {
      name: name,
      //def:def.ext,
      brick: brick,
    };

    // attach internal extension methods to ext (bound)
    if (def.ext.extension && typeof def.ext.extension === 'object') {
      for (const k in def.ext.extension) {
        if (!Object.prototype.hasOwnProperty.call(def.ext.extension, k)) continue;
        const fn = def.ext.extension[k];
        if (typeof fn === 'function') {
          ext[k] = fn.bind(ext);
        }
      }
    }

    // defaults options
    const defOpts = def.ext.options || def.ext._options;
    if (defOpts &&
        brick._controllers &&
        brick._controllers.options &&
        typeof brick._controllers.options.setSilent === 'function') {
      brick._controllers.options.setSilent(defOpts);
    }

    // expose API on brick namespace
    if (def.ext.brick && typeof def.ext.brick === 'object') {
      if (!brick[ns]) brick[ns] = {};
      const nsObj = brick[ns];
      for (const apiName in def.ext.brick) {
        if (!Object.prototype.hasOwnProperty.call(def.ext.brick, apiName)) continue;
        const apiFn = def.ext.brick[apiName];
        if (typeof apiFn !== 'function') {
          console.warn('VanillaBrick extension "' + name + '" api "' + apiName + '" is not a function');
          continue;
        }
        if (nsObj[apiName]) {
          console.warn('VanillaBrick extension overwriting API ' + ns + '.' + apiName);
        }
        nsObj[apiName] = apiFn.bind(brick);
      }
    }

            // init hook (this === ext)
    if (typeof def.ext.init === 'function') {
      try {
        const res = def.ext.init.call(ext);
        if (res === false) return;
      } catch (err) {
        console.error('VanillaBrick extension "' + name + '" init() failed', err);
        return;
      }
    }

    // register event listeners
    if (Array.isArray(def.ext.events) &&
        def.ext.events.length &&
        brick._controllers &&
        brick._controllers.events &&
        typeof brick._controllers.events.on === 'function') {

      for (let li = 0; li < def.ext.events.length; li += 1) {
        const evt = def.ext.events[li];
        if (!evt) continue;
        const parsed = parseForPattern(evt.for);

        ['before', 'on', 'after'].forEach(function (phase) {
          const desc = evt[phase];
          if (!desc || typeof desc.fn !== 'function') return;
          const pr = (typeof desc.priority === 'number') ? desc.priority : undefined;
          const pattern = parsed.ns + ':' + parsed.action + ':' + parsed.target;
          const wrapped = desc.fn.bind(ext);
          brick._controllers.events.on(pattern, phase, pr, wrapped, { ext: name, fn: desc.fn.name || 'anon' });
        });
      }
    }

    this.extensions[name] = ext;
  };

  ExtensionsController.prototype._ensureDestroyHook = function () {
    if (this._destroyHook) return;

    const brick = this.brick;
    if (!brick ||
        !brick._controllers ||
        !brick._controllers.events ||
        typeof brick._controllers.events.on !== 'function') {
      return;
    }

    this._destroyHook = true;
    const self = this;

    brick._controllers.events.on(
      'brick:destroy:*',
      'on',
      0,
      function () {
        for (const name in self.extensions) {
          if (!Object.prototype.hasOwnProperty.call(self.extensions, name)) continue;
          const ext = self.extensions[name];
          if (!ext || !ext.def) continue;
          const def = ext.def;

          if (typeof def.destroy === 'function') {
            try {
              def.destroy.call(ext);
            } catch (err) {
              console.error('VanillaBrick extension "' + (def.ns || name || '?') + '" destroy() failed', err);
            }
          }
        }

        self.extensions = {};
      }
    );
  };

  VanillaBrick.controllers.extensions = ExtensionsController;

