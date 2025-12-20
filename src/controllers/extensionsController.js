import ExtensionsRegistry from './extensionsRegistry.js';
import { mergeOptions } from '../utils/options.js';

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
 * Extensions Controller (Global Singleton)
 */
export default function ExtensionsController() {
  // No state here
}

function getRuntime() {
  return (globalThis.VanillaBrick && globalThis.VanillaBrick.runtime) ? globalThis.VanillaBrick.runtime : null;
}

/**
 * Initialize extensions for a brick
 */
ExtensionsController.prototype.init = function (brick) {
  if (!brick || !brick._runtime) return;
  brick._runtime.extensions = {
    map: {}, // Map of installed extensions { name: ctxExt }
    destroyHook: false
  };
};

ExtensionsController.prototype.applyAll = function (brick) {
  const registry = ExtensionsRegistry;
  if (!registry || typeof registry.all !== 'function') return;

  // Now registry returns a filtered, sorted, valid list
  const defs = registry.all(brick) || [];

  if (defs.length == 0) {
    return;
  }

  const runtime = getRuntime();

  // Ensure prototypes are baked (cached globally)
  if (runtime) {
    if (!runtime.prototypes) {
      runtime.prototypes = {};
    }
    // Check if we need to bake prototypes for these defs
    // We bake ALL returned defs just in case they are new
    const baked = registry._bake(defs);
    Object.assign(runtime.prototypes, baked);
  }

  // Phase 1: merge options before any init()
  const optionsCtrl = brick._controllers && brick._controllers.options;

  if (!mergeOptions || typeof mergeOptions !== 'function') {
    console.error('mergeOptions is missing; cannot merge extension defaults safely');
  } else if (optionsCtrl && typeof optionsCtrl.get === 'function') { // Check for .get instead of .all to be safe, or just existence
    // Get current user options
    const userOptions = (brick._runtime && brick._runtime.options) ? brick._runtime.options.data : {};
    const kind = (brick.kind || '').toLowerCase();
    const coreDefaults = [];
    const extDefaults = [];

    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i];
      const defOpts = def.ext.options || def.ext._options;
      if (!defOpts) continue;
      const defName = (def.ext.ns || def.name || '').toLowerCase();
      if (defName && kind && defName === kind + '-core') {
        coreDefaults.push(defOpts);
      } else {
        extDefaults.push(defOpts);
      }
    }

    const mergedOptions = mergeOptions.apply(null, coreDefaults.concat(extDefaults, [userOptions]));

    // Update brick options directly
    if (brick._runtime && brick._runtime.options) {
      brick._runtime.options.data = mergedOptions;
      brick._runtime.options.cache = {};
    }
  }

  // Phase 2: install + init extensions
  for (let i = 0; i < defs.length; i += 1) {
    this._install(brick, defs[i]);
  }

  this._ensureDestroyHook(brick);
};

ExtensionsController.prototype._install = function (brick, def) {
  const name = def.name || def.ext.ns || null;
  const ns = def.ext.ns || name;

  if (!name) {
    console.warn('VanillaBrick extension without name/ns, skipped', def);
    return;
  }

  const extState = (brick && brick._runtime) ? brick._runtime.extensions : null;
  if (!extState) return;
  if (extState.map[name]) return;

  // Get baked prototypes if available
  const runtime = getRuntime();
  const protos = (runtime && runtime.prototypes) ? runtime.prototypes[name] : null;

  let ctxExt;
  if (protos && protos.ext) {
    // Create extension context from prototype
    ctxExt = Object.create(protos.ext);
    // Assign specific instance properties
    ctxExt.brick = brick;
    ctxExt.ext = ctxExt; // self-ref for some legacy code patterns
    ctxExt._ctx = ctxExt;
  } else {
    // Fallback creation
    const ext = {
      name: name,
      def: def.ext,
      brick: brick
    };
    ctxExt = Object.create(ext);
    ctxExt.brick = brick;
    ctxExt.ext = ext;
    ctxExt._ctx = ctxExt;
  }

  // Inject Core APIs for context compatibility
  // Many legacy extensions expect 'this.options' to refer to the brick's options API
  Object.defineProperty(ctxExt, 'options', { value: brick.options, writable: false, enumerable: false, configurable: true });
  Object.defineProperty(ctxExt, 'events', { value: brick.events, writable: false, enumerable: false, configurable: true });
  Object.defineProperty(ctxExt, 'status', { value: brick.status, writable: false, enumerable: false, configurable: true });

  // API Context (what 'this' refers to in API methods)
  // Usually it mirrors ctxExt but for API mapping we might separate it conceptually
  const ctxApi = ctxExt;

  // Attach internal extension methods to ctxExt (if not using prototypes or just to be sure)
  // If prototypes are used, these methods might already be on the prototype chain, 
  // but if they are closures defined in the extension object, we might need to bind/wrap them.
  // Ideally, baked prototypes handle this. If NOT using baked prototypes, we do manual wrapping here.

  if (!protos) {
    // Manual internal method wrapping (Fallback)
    if (def.ext.extension && typeof def.ext.extension === 'object') {
      for (const k in def.ext.extension) {
        if (!Object.prototype.hasOwnProperty.call(def.ext.extension, k)) continue;
        const fn = def.ext.extension[k];
        if (typeof fn === 'function') {
          const meta = { type: 'extension-private', ext: name, brick: brick.id, fnName: k };
          ctxExt[k] = function () {
            const args = Array.prototype.slice.call(arguments);
            if (runtime && typeof runtime.execute === 'function') {
              return runtime.execute(fn, ctxExt, args, meta);
            }
            return fn.apply(ctxExt, args);
          };
        }
      }
    }
  }

  // Init hook
  if (typeof def.ext.init === 'function') {
    try {
      let res;
      if (runtime && typeof runtime.execute === 'function') {
        res = runtime.execute(def.ext.init, ctxExt, [], {
          type: 'init',
          ext: name,
          brick: brick.id,
          fnName: 'init'
        });
      } else {
        res = def.ext.init.call(ctxExt);
      }
      if (res === false) return;
    } catch (err) {
      console.error('VanillaBrick extension "' + name + '" init() failed', err);
      return;
    }
  }

  // Expose API on brick namespace
  // This is the CRITICAL part for additive namespaces
  if (def.ext.brick && typeof def.ext.brick === 'object') {
    // Ensure namespace object exists
    if (!brick[ns]) {
      brick[ns] = { _extData: {} };
    }

    const nsObj = brick[ns];
    if (!nsObj._extData) nsObj._extData = {}; // Safety check if brick[ns] was created by someone else

    if (protos && protos.api) {
      // Additive merge of baked prototypes
      // The baked methods are generic wrappers that look up _extData[name]
      Object.assign(nsObj, protos.api);

      // Store the specific data for this extension instance so the generic wrapper can find it
      nsObj._extData[name] = { ctx: ctxApi, fns: def.ext.brick, meta: {} };
    } else {
      // Manual Wrapping (Fallback)
      for (const apiName in def.ext.brick) {
        if (!Object.prototype.hasOwnProperty.call(def.ext.brick, apiName)) continue;
        const apiFn = def.ext.brick[apiName];
        if (typeof apiFn !== 'function') continue;

        // Warn if overwriting? Ideally properly managed namespaces don't collide on method names
        // if (nsObj[apiName]) console.warn(...)

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
  }

  // Register event listeners
  if (Array.isArray(def.ext.events) && def.ext.events.length) {
    // Check if events controller API is available on brick (it should be)
    if (brick.events && typeof brick.events.on === 'function') {
      for (let li = 0; li < def.ext.events.length; li += 1) {
        const evt = def.ext.events[li];
        if (!evt) continue;
        const parsed = parseForPattern(evt.for);
        const pattern = parsed.ns + ':' + parsed.action + ':' + parsed.target;

        ['before', 'on', 'after'].forEach(function (phase) {
          const desc = evt[phase];
          if (!desc || typeof desc.fn !== 'function') return;

          const pr = (typeof desc.priority === 'number') ? desc.priority : undefined;
          const meta = {
            type: 'event',
            ext: name,
            brick: brick.id,
            event: pattern,
            phase: phase,
            fnName: desc.fn.name || 'anon'
          };

          // Handler must be bound to extension context
          const handler = function (ev) {
            const args = [ev];
            if (runtime && typeof runtime.execute === 'function') {
              return runtime.execute(desc.fn, ctxExt, args, meta);
            }
            return desc.fn.apply(ctxExt, args);
          };

          // Use the public or direct API? Direct if we have access, but public is fine too.
          // Using direct call to controller is better inside controller logic
          brick.events.on(pattern, phase, pr, handler, { ext: name, fn: desc.fn.name });
        });
      }
    }
  }

  extState.map[name] = ctxExt;
};

ExtensionsController.prototype._ensureDestroyHook = function (brick) {
  const extState = (brick && brick._runtime) ? brick._runtime.extensions : null;
  if (!extState) return;
  if (extState.destroyHook) return;

  if (!brick || !brick.events || typeof brick.events.on !== 'function') {
    return;
  }

  extState.destroyHook = true;

  brick.events.on(
    'brick:status:destroyed',
    'on',
    0, // High priority
    function () {
      const runtime = getRuntime();

      for (const name in extState.map) {
        if (!Object.prototype.hasOwnProperty.call(extState.map, name)) continue;
        const ctxExt = extState.map[name];
        // The def is now inside _def if using prototypes, or def.ext if manual
        // Our context creation put definition in `_def` for baked ones.
        // Let's safe access it.
        const def = (ctxExt._def) ? { destroy: ctxExt._def.destroy, ns: ctxExt._name } : (ctxExt.def || {}); // Fallback

        if (typeof def.destroy === 'function') {
          try {
            if (runtime && typeof runtime.execute === 'function') {
              runtime.execute(def.destroy, ctxExt, [], {
                type: 'destroy',
                ext: name,
                brick: brick.id,
                fnName: 'destroy'
              });
            } else {
              def.destroy.call(ctxExt);
            }
          } catch (err) {
            console.error('VanillaBrick extension "' + name + '" destroy() failed', err);
          }
        }
      }
      extState.map = {};
    }
  );
};
