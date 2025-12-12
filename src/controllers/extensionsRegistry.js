// Diccionari de definicions d'extensions:
//   VanillaBrick.extensions.myExt = { ns: "myExt", ... }
VanillaBrick.extensions = VanillaBrick.extensions || {};

// Petit helper de registre/base
// (ara mateix només serveix per obtenir totes les definicions)
VanillaBrick.controllers.extensionsRegistry = VanillaBrick.controllers.extensionsRegistry || {
  /**
   * Retorna un array amb totes les definicions d'extensions
   * definides a VanillaBrick.extensions.*
   */
  _cache: {},

  /**
   * Retorna un array amb totes les definicions d'extensions
   * filtrades per brick kind i amb dependències resoltes (topological sort).
   *
   * @param {Object} brick - Instancia del brick o objecte de metadates {kind: '...'}
   */
  all: function (brick) {
    if (!brick || typeof brick !== 'object') {
      // Legacy/Fallback: return everything if no context is provided
      // (Though plan said strictly require it, we can fallback to old behavior or empty)
      // Let's stick strictly to plan: Empty or try to work?
      // User said "early-alpha i ens podem carregar el que volguem".
      // Let's return empty or warn. Returning empty is safer.
      console.warn('ExtensionsRegistry.all() called without brick context');
      return [];
    }

    const kind = brick.kind;
    if (!kind) return [];

    if (this._cache[kind]) {
      return this._cache[kind];
    }

    const src = VanillaBrick.extensions || {};
    const candidates = {};

    // 1. Initial Filter by Kind (and prepare candidates map)
    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      const def = src[key];
      if (!def || typeof def !== 'object') continue;

      // Normalitzar el nom intern
      if (!def._name) def._name = def.ns || key;

      // Check 'for' rule
      const rule = def.for || def._for;
      let match = false;

      if (!rule || rule === '*') {
        match = true;
      } else if (typeof rule === 'string') {
        match = (rule === kind);
      } else if (Array.isArray(rule)) {
        match = (rule.indexOf(kind) !== -1);
      }

      if (match) {
        candidates[key] = { name: key, ext: def };
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

      const candidate = candidates[name];
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

    this._cache[kind] = sortedList;
    return sortedList;
  }
};

