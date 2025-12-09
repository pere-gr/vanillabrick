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
