export const dom = {
  for: [{ host: 'brick', kind: '*' }],
  requires: [],
  ns: 'dom',
  options: {},

  brick: {
    element: function () {
      return this.options.get('dom.element', null);
    },
    on: function (type, handler, options) {
      const el = this.options.get('dom.element', null);
      if (!el || typeof el.addEventListener !== 'function' || typeof handler !== 'function') return;
      el.addEventListener(type, handler, options);
      let listeners = this.options.get('dom.listeners', []);
      if (!Array.isArray(listeners)) listeners = [];
      listeners.push({ type: type, handler: handler, options: options, source: 'api' });
      this.options.setSilent('dom.listeners', listeners);
    },
    off: function (type, handler, options) {
      const el = this.options.get('dom.element', null);
      if (!el || typeof el.removeEventListener !== 'function' || typeof handler !== 'function') return;
      el.removeEventListener(type, handler, options);
      const listeners = this.options.get('dom.listeners', []);
      if (!Array.isArray(listeners)) return;
      for (let i = listeners.length - 1; i >= 0; i -= 1) {
        const ln = listeners[i];
        if (ln.type === type && ln.handler === handler) {
          listeners.splice(i, 1);
        }
      }
      this.options.setSilent('dom.listeners', listeners);
    }
  },

  extension: {
    _resolveElement: function (value) {
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
    },
    _resolveById: function (id) {
      if (!id || typeof id !== 'string') return null;
      if (typeof document === 'undefined') return null;
      return document.getElementById(id) || null;
    }
  },

  events: [],

  init: function () {
    if (!this.brick) return false;
    const elemOpt = this.brick.options.get('dom.element', null);
    const idOpt = this.brick.options.get('dom.id', null);

    let el = this._resolveElement(elemOpt);
    if (!el && idOpt) {
      el = this._resolveById(idOpt);
    }

    if (!el) {
      console.warn('VanillaBrick dom extension requires a DOM element (options.dom.element) or a valid options.dom.id', this.brick.id);
      return false;
    }

    if (elemOpt && !this._resolveElement(elemOpt)) {
      console.warn('VanillaBrick dom element must be a DOM node or factory, not an id. Use options.dom.id to resolve by id.', this.brick.id);
    }

    this.brick.options.set('dom.element', el);
    return true;
  },

  destroy: function () {
    const el = this.brick.options.get('dom.element', null);
    const listeners = this.brick.options.get('dom.listeners', null);;
    if (el && Array.isArray(listeners)) {
      for (let i = 0; i < listeners.length; i += 1) {
        const ln = listeners[i];
        if (ln && ln.type && ln.handler) {
          el.removeEventListener(ln.type, ln.handler, ln.options);
        }
      }
    }
  }
};


export default dom;

