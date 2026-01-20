/**
 * Store Extension (Core)
 * Manages data state for bricks. Provides public API and coordinates
 * with strategy extensions (store-local, store-remote).
 */

// Sample data for development - TODO: move to fixtures
const DATA_SAMPLE_ROWS = [
  { code: '1', name: 'one', key: 1 },
  { code: '2', name: 'two', key: 2 },
  { code: '3', name: 'three', key: 3 },
  { code: '4', name: 'four', key: 4 },
  { code: '5', name: 'five', key: 5 },
  { code: '6', name: 'six', key: 6 },
  { code: '7', name: 'seven', key: 7 },
  { code: '8', name: 'eight', key: 8 },
  { code: '9', name: 'nine', key: 9 },
  { code: '10', name: 'ten', key: 10 }
];

export const store = {
  for: [{ host: 'brick', kind: '*' }],
  requires: [],
  ns: 'store',
  options: {
    store: {
      type: 'local',     // 'local' | 'remote'
      uidField: 'key',
      data: []
    }
  },

  /**
   * Public Brick API (this = extension context with this.brick)
   */
  brick: {
    /**
     * Get the configured UID field name
     * @returns {string}
     */
    uidField: function () {
      return this.brick.options.get('store.uidField', 'key');
    },

    /**
     * Get current store data array (Sparse Array)
     * @returns {Array}
     */
    data: function () {
      return this.brick.options.get('store.data', []);
    },

    /**
     * Get current store type
     * @returns {string} 'memory' | 'local' | 'remote'
     */
    type: function () {
      return this.brick.options.get('store.type', 'memory');
    },

    /**
     * Ensure a specific range of data is loaded.
     * Fires 'store:data:ensure' if gaps are found.
     * @param {number} start - Start index
     * @param {number} count - Number of items
     * @returns {Promise}
     */
    ensureRange: async function (start, count) {
      const data = this.brick.options.get('store.data', []);
      const total = this.brick.options.get('store.totalCount', 0);

      // If we know the total, cap the request
      if (total > 0 && start >= total) return;
      const effectiveCount = (total > 0) ? Math.min(count, total - start) : count;

      // Check for gaps
      let hasGap = false;
      for (let i = start; i < start + effectiveCount; i++) {
        if (!data[i]) {
          hasGap = true;
          break;
        }
      }

      if (hasGap) {
        // Fire ensure event (strategies should handle this)
        // Basic debounce/throttle could be added here if needed to avoid spamming
        await this.brick.events.fireAsync('store:data:ensure', { start: start, count: effectiveCount });
      }
    },

    /**
     * Trigger full data load/reset
     * @returns {Promise}
     */
    load: async function () {
      // Clear data for fresh load
      this.brick.options.setSilent('store.data', []);
      // Reset total count to default (if configured) or 0
      const defaultTotal = this.brick.options.get('store.defaultTotalCount', 0);
      this.brick.options.setSilent('store.totalCount', defaultTotal);
      return this.brick.events.fireAsync('store:data:load', {});
    },

    /**
     * Set store data directly (updates specific range or full replace)
     * @param {Array} rows - New data rowsv
     * @param {number} [start=0] - Starting index (if partial update)
     * @returns {Object} brick
     */
    set: function (rows, start) {
      if (!rows) return this.brick;
      const newRows = Array.isArray(rows) ? rows : [rows];
      const currentData = this.brick.options.get('store.data', []);
      const total = this.brick.options.get('store.totalCount', 0);

      // If start is provided, merge. Else replace.
      let nextData;
      if (typeof start === 'number') {
        nextData = currentData; // In-place mutation of the array reference (be careful with reactivity if we had deep watchers)
        // We prefer creating a new reference for safety in some frameworks, but for vanilla huge arrays, mutation is better.
        // Let's stick to mutation for performance, but trigger update.
        for (let i = 0; i < newRows.length; i++) {
          nextData[start + i] = newRows[i];
        }
        // Auto-update total count if we grew past it
        if (nextData.length > total) {
          this.brick.options.setSilent('store.totalCount', nextData.length);
        }
      } else {
        nextData = newRows; // Full replace
        this.brick.options.setSilent('store.totalCount', nextData.length);
      }

      this.brick.options.setSilent('store.data', nextData);

      this.brick.events.fire('store:data:updated', {
        data: nextData,
        start: start || 0,
        count: newRows.length
      });

      return this.brick;
    },

    /**
     * Get all records (careful with large sparse arrays)
     * @returns {Array}
     */
    all: function () {
      return this.brick.options.get('store.data', []);
    },

    /**
     * Get record by index
     * @param {number} index
     * @returns {Object|null}
     */
    get: function (index) {
      const arr = this.brick.options.get('store.data', []);
      return arr[index] || null;
    },

    /**
     * Get record by UID
     * @param {*} uid
     * @returns {Object|null}
     */
    find: function (uid) {
      const arr = this.brick.options.get('store.data', []);
      const field = this.brick.store.uidField();
      // Linear search is slow for huge arrays. 
      // TODO: Implement Lookup Map in future update
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i][field] === uid) return arr[i];
      }
      return null;
    },

    /**
     * Get total record count
     * @returns {number}
     */
    count: function () {
      return this.brick.options.get('store.totalCount', 0);
    },

    /**
     * Trigger sort operation
     * @param {string} field
     * @param {string} dir
     * @param {Function} compareFn
     */
    sort: function (field, dir, compareFn) {
      // Sorting a sparse array/remote data is complex.
      // For now, we fire event so Remote strategy can reload with sort params.
      this.brick.events.fire('store:data:sort', {
        field: field,
        dir: dir || 'asc',
        compare: compareFn
      });
      return this.brick;
    }
  },

  /**
   * Private extension helpers (this = extension context)
   */
  extension: {
    /**
     * Normalize value to array
     * @param {*} value
     * @param {Array} fallback
     * @returns {Array}
     */
    _normalizeArray: function (value, fallback) {
      if (Array.isArray(value)) return value.slice();
      return Array.isArray(fallback) ? fallback.slice() : [];
    },

    /**
     * Sort rows by field
     * @param {Array} rows
     * @param {string} field
     * @param {string} dir - 'asc' or 'desc'
     * @param {Function} compareFn - Optional custom compare
     * @returns {Array} sorted copy
     */
    _sortRows: function (rows, field, dir, compareFn) {
      const arr = Array.isArray(rows) ? rows.slice() : [];
      const direction = dir === 'desc' ? -1 : 1;

      const cmp = typeof compareFn === 'function'
        ? function (a, b) { return compareFn(a, b, dir); }
        : function (a, b) {
          const va = a && Object.prototype.hasOwnProperty.call(a, field) ? a[field] : undefined;
          const vb = b && Object.prototype.hasOwnProperty.call(b, field) ? b[field] : undefined;

          if (va === vb) return 0;
          if (va === undefined || va === null) return -1 * direction;
          if (vb === undefined || vb === null) return 1 * direction;
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * direction;
          return String(va).localeCompare(String(vb)) * direction;
        };

      arr.sort(cmp);
      return arr;
    },

  },

  /**
   * Event handlers
   */
  events: [
    // On brick ready, trigger store load
    {
      for: 'brick:status:ready',
      on: {
        priority: 5,
        fn: function () {
          const storeType = this.brick.options.get('store.type', 'local');
          const existingData = this.brick.options.get('store.data', null);

          // Only load sample data for local type with no data (dev mode)
          if (storeType === 'local' && (!existingData || existingData.length === 0)) {
            const sampleData = this._normalizeArray(DATA_SAMPLE_ROWS, []);
            this.brick.options.setSilent('store.data', sampleData);
          }

          // Trigger load for all types
          this.brick.store.load();
        }
      }
    },

    // Handle store:data:set - persist data to options
    {
      for: 'store:data:set',
      on: {
        priority: 5,
        fn: function (ev) {
          const payload = (ev && ev.data) || {};
          const data = payload.data || [];
          this.brick.options.setSilent('store.data', data);
          ev.data = { data: data, previous: payload.previous };
        }
      }
    },

    // Handle store:data:sort
    {
      for: 'store:data:sort',
      on: {
        priority: 5,
        fn: function (ev) {
          const payload = (ev && ev.data) || {};
          const field = payload.field;
          const dir = payload.dir || 'asc';

          if (!field) return;

          const currentData = this.brick.options.get('store.data', []);
          const sorted = this._sortRows(currentData, field, dir, payload.compare);

          this.brick.options.setSilent('store.data', sorted);
          ev.data = { data: sorted, field: field, dir: dir };
        }
      }
    }
  ],

  init: function () {
    // Extension initialized
  },

  destroy: function () {
    // Cleanup if needed
  }
};

export default store;
