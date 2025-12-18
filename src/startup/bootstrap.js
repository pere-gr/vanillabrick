export function setupBootstrap(VanillaBrick) {
  VanillaBrick.base = VanillaBrick.base || {};
  VanillaBrick.configs = VanillaBrick.configs || {};

  const registry = {
    list: [],
    byId: {},
  };

  function loadConfigs(scope) {
    if (typeof document === 'undefined') return;
    const root = scope || document;
    if (!root.querySelectorAll) return;
    const scripts = root.querySelectorAll('script[type="application/json"][data-brick]');
    for (let i = 0; i < scripts.length; i += 1) {
      const node = scripts[i];
      const raw = node.textContent || '';
      if (!raw.trim()) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;
        for (const key in parsed) {
          if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
          const base = (VanillaBrick.configs[key] && typeof VanillaBrick.configs[key] === 'object')
            ? VanillaBrick.configs[key]
            : {};
          const next = parsed[key];
          if (!next || typeof next !== 'object') continue;
          VanillaBrick.configs[key] = Object.assign({}, base, next);
        }
      } catch (err) {
        console.warn('VanillaBrick: invalid JSON in data-brick config', err);
      }
    }
  }

  function readKind(el) {
    if (!el) return undefined;
    // data-kind o data-brick-kind
    const k =
      el.getAttribute('brick-kind') ||
      el.getAttribute('data-kind') ||
      el.getAttribute('data-brick-kind') ||
      (el.dataset && (el.dataset.kind || el.dataset.brickKind));
    return k ? String(k).toLowerCase() : undefined;
  }

  function createBrickFromElement(el) {
    if (!el) return null;

    // Ja inicialitzat?
    if (el.__brickInstance) return el.__brickInstance;

    const opts = {};

    const config = el.id && VanillaBrick.configs ? VanillaBrick.configs[el.id] : null;
    if (config && typeof config === 'object') {
      Object.assign(opts, config);
    }

    if (el.id) {
      opts.id = el.id;
    }

    const kind = readKind(el);
    if (kind) {
      opts.kind = kind;
    }

    // NESTED: tot el que és de DOM sota dom.{}
    opts.dom = {
      id: el.id || null,
      element: el
    };

    const brick = new VanillaBrick.brick(opts);

    el.__brickInstance = brick;
    registry.list.push(brick);
    registry.byId[brick.id] = brick;
    console.log("Brick", el.id, brick);
    return brick;
  }

  function bootstrap(root) {
    if (typeof document === 'undefined') return [];
    const scope = root || document;
    if (!scope.querySelectorAll) return [];

    // Carrega tots els blocs de configuració abans de crear bricks
    loadConfigs(scope);

    const nodes = scope.querySelectorAll('.vb');
    const created = [];

    for (let i = 0; i < nodes.length; i++) {
      const brick = createBrickFromElement(nodes[i]);
      if (brick) created.push(brick);
    }

    return created;
  }

  VanillaBrick.base.bootstrap = bootstrap;
  VanillaBrick.runtime = VanillaBrick.runtime || {};
  VanillaBrick.runtime.bricks = registry.list || [];
  VanillaBrick.base.getBrick = function (id) {
    return registry.byId[id] || null;
  };

  if (typeof document !== 'undefined') {
    var bootstrapped = false;
    function runOnce() {
      if (bootstrapped) return;
      bootstrapped = true;
      bootstrap();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        runOnce();
      });
    } else {
      // DOM ja llest: posposem al next tick per deixar executar scripts defer restants
      setTimeout(runOnce, 0);
    }
  }
}

