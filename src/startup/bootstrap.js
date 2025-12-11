
  VanillaBrick.base = VanillaBrick.base || {};

  const registry = {
    list: [],
    byId: {},
  };

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
    console.log("Brick",el.id,brick);
    return brick;
  }

  function bootstrap(root) {
    if (typeof document === 'undefined') return [];
    const scope = root || document;
    if (!scope.querySelectorAll) return [];

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


