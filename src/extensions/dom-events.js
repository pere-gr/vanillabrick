VanillaBrick.extensions.domEvents = {
  for: '*',
  requires: ['dom'],
  ns: 'dom',
  options: {},

  brick: {},

  extension: {},

  events: [
    {
      for: 'brick:ready:*',
      on: {
        fn: function () {
          const el = this.brick.dom.element();
          if (!el || typeof el.addEventListener !== 'function') return;
          const listeners = this.brick.options.get("dom.events.listeners",[]);
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
              this.brick.events.fire(entry.eventName, {
                domEvent: domEvent,
                element: el,
              });
            };
            el.addEventListener(entry.type, handler.bind(this));
            listeners.push({ type: entry.type, handler: handler, source: 'default' });
          }
          this.brick.options.setSilent("dom.events.listeners", listeners);
        }
      }
    },
    {
      for: 'brick:destroy:*',
      before: {
        fn: function () {
          const el = this.brick && this.brick.dom.element && this.brick.dom.element();
          if (!el || typeof el.removeEventListener !== 'function') return;
          const listeners = this._listeners || [];
          for (let i = 0; i < listeners.length; i += 1) {
            const ln = listeners[i];
            el.removeEventListener(ln.type, ln.handler, ln.options);
          }
          this._listeners = [];
        }
      }
    }
  ],

  init: function() {},
  destroy: function () {}
};

