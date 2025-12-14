

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

function isArrowFunction(fn) {
  if (typeof fn !== 'function') return false;
  // Arrow functions have no prototype and typically stringify with "=>"
  if (fn.prototype) return false;
  try {
    return fn.toString().indexOf('=>') !== -1;
  } catch (e) {
    return false;
  }
}

ExtensionsController.prototype.applyAll = function () {
  const registry = VanillaBrick.controllers.extensionsRegistry;
  if (!registry || typeof registry.all !== 'function') return;

  // Now registry returns a filtered, sorted, valid list
  const defs = registry.all(this.brick) || [];

  if (defs.length == 0) {
    console.warn("No extensions found for this brick", this.brick);
    return;
  }

  for (let i = 0; i < defs.length; i += 1) {
    this._install(defs[i]);
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
    def: def.ext,
    brick: brick,
  };
  // Contexts with prototype chaining to preserve access to brick/extension state
  const ctxExt = Object.create(ext);
  ctxExt.brick = brick;
  ctxExt.ext = ext;
  const ctxApi = Object.create(brick);
  ctxApi.brick = brick;
  ctxApi.ext = ext;

  // attach internal extension methods to ext (bound + wrapped)
  const runtime = brick._controllers.runtime;
  if (def.ext.extension && typeof def.ext.extension === 'object') {
    for (const k in def.ext.extension) {
      if (!Object.prototype.hasOwnProperty.call(def.ext.extension, k)) continue;
      const fn = def.ext.extension[k];
      if (typeof fn === 'function') {
        if (isArrowFunction(fn)) {
          console.warn('VanillaBrick: arrow functions discouraged for extension private method', { ns: name, fn: k, kind: brick.kind });
        }
        const meta = { type: 'extension-private', ext: name, brick: brick.id, fnName: k };
        ext[k] = function () {
          const args = Array.prototype.slice.call(arguments);
          if (runtime && typeof runtime.execute === 'function') {
            return runtime.execute(fn, ctxExt, args, meta);
          }
          return fn.apply(ctxExt, args);
        };
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

  // expose API on brick namespace (wrapped)
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
      if (isArrowFunction(apiFn)) {
        console.warn('VanillaBrick: arrow functions discouraged for brick API', { ns: name, api: apiName, kind: brick.kind });
      }
      if (nsObj[apiName]) {
        console.warn('VanillaBrick extension overwriting API ' + ns + '.' + apiName);
      }
      const meta = { type: 'brick-api', ext: name, brick: brick.id, fnName: ns + '.' + apiName };
      nsObj[apiName] = function () {
        const args = Array.prototype.slice.call(arguments);
        if (runtime && typeof runtime.execute === 'function') {
          return runtime.execute(apiFn, ctxApi, args, meta);
        }
        return apiFn.apply(ctxApi, args);
      };
    }
  }

  // init hook (this === ext, wrapped)
  if (typeof def.ext.init === 'function') {
    const runtime = brick._controllers.runtime;
    try {
      let res;
      if (runtime && typeof runtime.execute === 'function') {
        res = runtime.execute(def.ext.init, ext, [], {
          type: 'init',
          ext: name,
          brick: brick.id,
          fnName: 'init'
        });
      } else {
        res = def.ext.init.call(ext);
      }
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
        if (isArrowFunction(desc.fn)) {
          console.warn('VanillaBrick: arrow functions discouraged for event handler', { ns: name, event: pattern, phase: phase, kind: brick.kind });
        }
        const pr = (typeof desc.priority === 'number') ? desc.priority : undefined;
        const pattern = parsed.ns + ':' + parsed.action + ':' + parsed.target;
        const meta = {
          type: 'event',
          ext: name,
          brick: brick.id,
          event: pattern,
          phase: phase,
          fnName: desc.fn.name || 'anon'
        };
        const handler = function (ev) {
          const args = [ev];
          if (runtime && typeof runtime.execute === 'function') {
            return runtime.execute(desc.fn, ctxExt, args, meta);
          }
          return desc.fn.apply(ctxExt, args);
        };
        brick._controllers.events.on(pattern, phase, pr, handler, { ext: name, fn: desc.fn.name || 'anon', extInstance: ext });
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
    'brick:status:destroyed',
    'on',
    0,
    function () {
      for (const name in self.extensions) {
        if (!Object.prototype.hasOwnProperty.call(self.extensions, name)) continue;
        const ext = self.extensions[name];
        if (!ext || !ext.def) continue;
        const def = ext.def;

        if (typeof def.destroy === 'function') {
          const runtime = brick._controllers.runtime;
          try {
            if (runtime && typeof runtime.execute === 'function') {
              runtime.execute(def.destroy, ext, [], {
                type: 'destroy',
                ext: name,
                brick: brick.id,
                fnName: 'destroy'
              });
            } else {
              def.destroy.call(ext);
            }
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
