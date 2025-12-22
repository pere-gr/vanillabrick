// Retorna un array amb totes les definicions d'extensions d'un objecte font
const ExtensionsRegistry = {
  /**
   * Retorna un array amb totes les definicions d'extensions
   * definides a la font (habitualment l'objecte d'extensions passat)
   */
  _cache: {},

  /**
   * Retorna un array amb totes les definicions d'extensions
   * filtrades per host/kind i amb dependències resoltes (topological sort).
   *
   * @param {Object} brick - Instancia del brick o objecte de metadates {host:'brick', kind:'table'}
   */
  all: function (brick) {
    if (!brick || typeof brick !== 'object') {
      console.warn('ExtensionsRegistry.all() called without brick context');
      return [];
    }

    const host = (brick.host || 'brick').toLowerCase();
    const kind = (brick.kind || '').toLowerCase();
    if (!kind) return [];

    const cacheKey = host + '::' + kind;
    if (this._cache[cacheKey]) {
      return this._cache[cacheKey];
    }

    const src = (globalThis.VanillaBrick && globalThis.VanillaBrick.extensions) || {};
    const candidates = {};
    const seenExtensions = new Set();

    function normalizeRule(rule) {
      if (!rule || typeof rule !== 'object') return null;
      const rHost = (rule.host || 'brick').toLowerCase();
      const rKind = typeof rule.kind === 'string' ? rule.kind.toLowerCase() : '';
      if (!rKind) return null;
      return { host: rHost, kind: rKind };
    }

    function matchesRule(rule, currentHost, currentKind) {
      if (!rule) return false;
      const hostMatch = rule.host === '*' || rule.host === currentHost;
      const kindMatch = rule.kind === '*' || rule.kind === currentKind;
      return hostMatch && kindMatch;
    }

    // 1. Initial Filter by host/kind (and prepare candidates map)
    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      const def = src[key];
      if (!def || typeof def !== 'object') continue;

      // Skip if we've already seen this exact extension definition object
      if (seenExtensions.has(def)) continue;

      // Normalitzar el nom intern
      if (!def._name) def._name = def.ns || key;

      const rules = def.for;
      if (!Array.isArray(rules) || !rules.length) {
        console.warn('VanillaBrick extension without valid `for` array, skipped', def._name || key);
        continue;
      }

      let match = false;
      for (let ri = 0; ri < rules.length; ri += 1) {
        const rule = normalizeRule(rules[ri]);
        if (!rule) continue;
        if (matchesRule(rule, host, kind)) {
          match = true;
          break;
        }
      }

      if (match) {
        candidates[key] = { name: key, ext: def };
        seenExtensions.add(def);
      }
    }

    // 2. Recursive Validation & Topological Sort (DFS)
    const sortedList = [];
    // Status: undefined (unvisited), 'visiting', 'ok', 'missing'
    const status = {};

    function visit(name) {
      if (status[name] === 'ok') return true;
      if (status[name] === 'visiting') return false; // Cycle detection
      if (status[name] === 'missing') return false;

      let candidate = candidates[name];

      // If not found by name, search for a candidate with matching .ns
      if (!candidate) {
        for (const k in candidates) {
          if (candidates[k].ext.ns === name) {
            candidate = candidates[k];
            break;
          }
        }
      }

      if (!candidate) {
        status[name] = 'missing';
        return false;
      }

      status[name] = 'visiting';

      const reqs = candidate.ext.requires || candidate.ext._requires;
      if (Array.isArray(reqs)) {
        for (let i = 0; i < reqs.length; i++) {
          const depName = reqs[i];
          if (!visit(depName)) {
            status[name] = 'missing'; // Dependency failed
            return false;
          }
        }
      }

      status[name] = 'ok';
      sortedList.push(candidate);
      return true;
    }

    for (const name in candidates) {
      visit(name);
    }

    this._cache[cacheKey] = sortedList;
    return sortedList;
  },

  /**
   * Genera els prototips i contextos per a un brick específic o de forma genèrica.
   * Aquesta funció es crida una vegada per tipus d'extensió per generar els "motlles".
   */
  _bake: function (defs) {
    const prototypes = {};

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const name = def.name || def.ext.ns;

      // 1. Prototype for the extension context (ctxExt)
      // Contains the extension definition and helper methods.
      // 'brick' will be assigned at instantiation time.
      const protoExt = {
        _name: name,
        _def: def.ext
      };

      // Bake internal extension methods into the prototype
      // This ensures 'this._helper()' works inside init/destroy/handlers
      if (def.ext.extension && typeof def.ext.extension === 'object') {
        for (const k in def.ext.extension) {
          if (typeof def.ext.extension[k] === 'function') {
            protoExt[k] = def.ext.extension[k];
          }
        }
      }

      // 2. Prototype for the API context (ctxApi)
      // Contains the 'brick' API methods exposed by this extension.
      // These methods are bound to ctxApi, which has access to ctxExt.
      const protoApi = {};

      // Bake API methods
      if (def.ext.brick) {
        for (const k in def.ext.brick) {
          if (typeof def.ext.brick[k] === 'function') {
            // We use a closure here to trap 'name' and 'k' correctly
            (function (methodName, methodFn, extName) {
              protoApi[methodName] = function () {
                // This function will be called on the namespace object (e.g. brick.table.refresh())
                // We need to find the specific context for this extension instance

                // 'this' is the namespace object (brick[ns])
                // It contains _extData map: { extName: { ctx: ctxApi, fns:..., meta:... } }
                const extData = this._extData && this._extData[extName];

                if (!extData) {
                  console.warn(`VanillaBrick: Extension data not found for ${extName} in namespace API call ${methodName}`);
                  return;
                }

                const args = Array.prototype.slice.call(arguments);
                const runtime = (globalThis.VanillaBrick) ? globalThis.VanillaBrick.runtime : null;

                if (runtime && typeof runtime.execute === 'function') {
                  // Metadata for debugging/tracing
                  const meta = {
                    type: 'brick-api',
                    ext: extName,
                    brick: extData.ctx.brick ? extData.ctx.brick.id : 'unknown',
                    fnName: methodName
                  };
                  return runtime.execute(methodFn, extData.ctx, args, meta);
                }

                return methodFn.apply(extData.ctx, args);
              };
            })(k, def.ext.brick[k], name);
          }
        }
      }

      prototypes[name] = {
        ext: protoExt,
        api: protoApi
      };
    }

    return prototypes;
  }
};

export default ExtensionsRegistry;

