/**
 * Store Local Strategy
 * Handles store:data:load for type='local' configuration.
 * Data source: brick options (pre-configured data).
 */

export const storeLocal = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['store'],
  ns: 'store',
  options: {},

  /**
   * No additional public API - uses store.js API
   */
  brick: {},

  extension: {
    _masterData: null,

    _isEnabled: function () {
      const type = this.brick.options.get('store.type', 'local');
      return type === 'local' || type === '' || type === null || type === undefined;
    },

    /**
     * Cache initial data from options
     */
    _initMasterData: function () {
      if (this._masterData) return;
      // Grab initial data provided in options before any clear happens
      const initial = this.brick.options.get('store.data', []);
      this._masterData = Array.isArray(initial) ? initial.slice() : [];
    }
  },

  events: [
    {
      for: 'brick:status:ready',
      on: {
        priority: 1, // High priority to grab data before store.load clears it
        fn: function () {
          if (!this._isEnabled()) return;
          this._initMasterData();
        }
      }
    },
    {
      for: 'store:data:load',
      on: {
        priority: 5,
        fn: function (ev) {
          if (!this._isEnabled()) return;

          // Restore from master
          const data = this._masterData || [];

          // For local store, we just set everything at once
          this.brick.store.set(data);
          // And explicitly set totalCount (though store.set logic does it too, let's be sure)
          this.brick.options.setSilent('store.totalCount', data.length);

          ev.data = { data: data, source: 'local', count: data.length };
        }
      }
    },
    {
      // Handle ensure requests (trivial for local, but needed for consistency)
      for: 'store:data:ensure',
      on: {
        fn: function (ev) {
          if (!this._isEnabled()) return;
          // Local already has everything loaded in 'load', but if something was cleared...
          // We can re-inject range from masterData
          if (!this._masterData) return;

          const start = ev.data.start || 0;
          const count = ev.data.count || 1;
          const slice = this._masterData.slice(start, start + count);

          this.brick.store.set(slice, start);
        }
      }
    }
  ],

  init: function () {
    // Local strategy initialized
  },

  destroy: function () {
    // Cleanup if needed
  }
};

export default storeLocal;