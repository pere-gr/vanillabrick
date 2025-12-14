VanillaBrick.extensions.domEvents = {
  for: '*',
  requires: ['dom'],
  ns: 'dom',
  options: {},

  brick: {},

  extension: {},

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function () {
          const el = this.brick.dom.element();
          if (!el || typeof el.addEventListener !== 'function') return;
          let listeners = this.brick.options.get("dom.events.listeners", []);
          if (!Array.isArray(listeners)) listeners = [];
          const self = this;
          const defaultMap = [
            { type: 'click', eventName: 'dom:mouse:click' },
            { type: 'mouseenter', eventName: 'dom:hover:on' },
            { type: 'mouseleave', eventName: 'dom:hover:off' },
            { type: 'mousedown', eventName: 'dom:mouse:down' },
            { type: 'mouseup', eventName: 'dom:mouse:up' },
          ];

          for (let i = 0; i < defaultMap.length; i += 1) {
            const entry = defaultMap[i];
            const handler = function handler(domEvent) {
              self.brick.events.fire(entry.eventName, {
                domEvent: domEvent,
                element: el,
              });
            };
            el.addEventListener(entry.type, handler);
            listeners.push({ type: entry.type, handler: handler, source: 'default' });
          }
          this.brick.options.setSilent("dom.events.listeners", listeners);
        }
      }
    },
    {
      for: 'brick:status:destroyed',
      before: {
        fn: function () {
          const el = this.brick && this.brick.dom.element && this.brick.dom.element();
          if (!el || typeof el.removeEventListener !== 'function') return;
          const listeners = this.brick.options.get("dom.events.listeners", []);
          if (!Array.isArray(listeners)) return;
          for (let i = 0; i < listeners.length; i += 1) {
            const ln = listeners[i];
            el.removeEventListener(ln.type, ln.handler, ln.options);
          }
          this.brick.options.setSilent("dom.events.listeners", []);
        }
      }
    }
  ],

  init: function () { },
  destroy: function () { }
};
