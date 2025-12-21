export const htmlEvents = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['html'],
  ns: 'html',
  options: {},

  brick: {
    on: function (el, type, handler, options) {
      if (!el || typeof el.addEventListener !== 'function' || typeof handler !== 'function') return;
      el.addEventListener(type, handler, options);
      let listeners = this.brick.options.get('html.listeners', []);
      if (!Array.isArray(listeners)) listeners = [];
      listeners.push({ el: el, type: type, handler: handler, options: options, source: 'api' });
      this.brick.options.setSilent('html.listeners', listeners);
    },
    off: function (el, type, handler, options) {
      if (!el || typeof el.removeEventListener !== 'function' || typeof handler !== 'function') return;
      el.removeEventListener(type, handler, options);
      const listeners = this.brick.options.get('html.listeners', []);
      if (!Array.isArray(listeners)) return;
      for (let i = listeners.length - 1; i >= 0; i -= 1) {
        const ln = listeners[i];
        if (ln.type === type && ln.handler === handler) {
          listeners.splice(i, 1);
        }
      }
      this.brick.options.setSilent('html.listeners', listeners);
    }
  },

  extension: {},

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function () {
          const el = this.brick.html.element();
          if (!el || typeof el.addEventListener !== 'function') return;
          let listeners = this.brick.options.get("html.events.listeners", []);
          if (!Array.isArray(listeners)) listeners = [];
          const self = this;
          const defaultMap = [
            { type: 'click', eventName: 'html:event:click' },
            { type: 'mouseenter', eventName: 'html:event:mouseenter' },
            { type: 'mouseleave', eventName: 'html:event:mouseleave' },
            { type: 'mousedown', eventName: 'html:event:mousedown' },
            { type: 'mouseup', eventName: 'html:event:mouseup' },
          ];

          for (let i = 0; i < defaultMap.length; i += 1) {
            const entry = defaultMap[i];
            const handler = function handler(domEvent) {
              self.brick.events.fire(entry.eventName, {
                domEvent: domEvent,
                element: el,
              });
            };
            this.brick.html.on(el,entry.type,handler);
          }
        }
      }
    },
    {
      for: 'brick:status:destroyed',
      before: {
        fn: function () {
          const el = this.brick && this.brick.html.element && this.brick.html.element();
          if (!el || typeof el.removeEventListener !== 'function') return;
          const listeners = this.brick.options.get("html.events.listeners", []);
          if (!Array.isArray(listeners)) return;
          for (let i = 0; i < listeners.length; i += 1) {
            const ln = listeners[i];
            this.brick.html.off(el,ln.type,ln.handler,ln.options);
          }
        }
      }
    }
  ],

  init: function () { },
  destroy: function () { }
};


export default htmlEvents;

