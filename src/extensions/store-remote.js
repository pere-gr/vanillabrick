/**
 * Store Remote Strategy
 * Handles store:data:load for type='remote' configuration.
 * Data source: HTTP fetch from configured URL.
 */

export const storeRemote = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['store'],
  ns: 'store',
  options: {},

  /**
   * No additional public API - uses store.js API
   */
  brick: {},

  /**
   * Private extension helpers
   */
  extension: {
    /**
     * Check if this strategy should handle the request
     * @returns {boolean}
     */
    _isEnabled: function () {
      const type = this.brick.options.get('store.type', '');
      return type === 'remote';
    },

    /**
     * Fetch data from remote URL
     * @param {Object} query - Query parameters
     * @param {string} query.url - URL to fetch from
     * @returns {Promise<Array>}
     */
    _fetchData: async function (query) {
      if (!query || !query.url) {
        console.warn('[store-remote] No URL configured for remote store');
        return [];
      }

      const config = this.brick.options.get('store.pagination', {});
      const mode = config.mode || 'client'; // Default to client-side pagination (load all) if not specified
      const params = config.params || {};
      const keyOffset = params.offset || 'offset';
      const keyLimit = params.limit || 'limit';

      const urlObj = new URL(query.url, window.location.origin);

      // Apply pagination params only if mode is 'server'
      if (mode === 'server') {
        if (typeof query.start === 'number') urlObj.searchParams.append(keyOffset, query.start);
        if (typeof query.count === 'number') urlObj.searchParams.append(keyLimit, query.count);
      } else {
        // Client mode: maybe we want to send a logical limit?
        // Usually client mode means "fetch all", so we don't append limits unless config.fetchLimit explicitly set
      }

      const res = await fetch(urlObj.toString());
      if (!res.ok) {
        throw new Error('[store-remote] HTTP ' + res.status + ' fetching ' + urlObj.toString());
      }
      return await res.json();
    }
  },

  /**
   * Event handlers
   */
  events: [
    {
      for: 'store:data:load',
      on: {
        priority: 5,
        fn: async function (ev) {
          if (!this._isEnabled()) return;
          const config = this.brick.options.get('store', {});

          // Initial load: fetch first page or whatever configured
          const pageSize = config.pagination && config.pagination.pageSize ? config.pagination.pageSize : (config.pageSize || 50);

          const query = {
            url: config.url || null,
            start: 0,
            count: pageSize
          };

          try {
            const result = await this._fetchData(query);
            // 1. Normalize response
            let items = [];
            let remoteTotal = null;

            if (Array.isArray(result)) {
              items = result;
              // Plain array has no metadata about total count
            } else if (result && result.data && Array.isArray(result.data)) {
              items = result.data;
              // Standard metadata fields
              if (typeof result.total === 'number') remoteTotal = result.total;
              else if (typeof result.totalCount === 'number') remoteTotal = result.totalCount;
              else if (typeof result.count === 'number') remoteTotal = result.count;
            }

            // 2. Determine Final Total Count Logic
            let finalTotal = 0;
            const configuredDefault = this.brick.options.get('store.defaultTotalCount', 0);
            const currentTotal = this.brick.options.get('store.totalCount', 0);
            const isServerMode = (this.brick.options.get('store.pagination.mode') === 'server');

            if (remoteTotal !== null) {
              // CASE A: API explicitly tells us the total. Trust the API.
              finalTotal = remoteTotal;
            } else if (!isServerMode) {
              // CASE B: Client Mode (Load All). The array length IS the total.
              finalTotal = items.length;
            } else {
              // CASE C: Server Mode but NO total info from API.
              // We are flying blind. We rely on configuration or preserve existing knowledge.

              // If we have a configured default (e.g. for dumb APIs like jsonplaceholder), use it.
              if (configuredDefault > 0) {
                finalTotal = configuredDefault;
              } else {
                // Fallback: assume the current page length is what we have, 
                // or keep the current total if it's larger (to avoid shrinking table mid-scroll)
                finalTotal = Math.max(currentTotal, items.length);
              }
            }

            // 3. Update Store State
            if (finalTotal > 0) {
              this.brick.options.setSilent('store.totalCount', finalTotal);
            }

            this.brick.store.set(items, query.start || 0);

            console.info(`[store-remote] Loaded ${items.length} items. Mode: ${isServerMode ? 'Server' : 'Client'}. Total set to: ${finalTotal}`);

            ev.data = { data: items, source: 'remote', url: query.url };
          } catch (err) {
            console.error('[store-remote] Load failed:', err);
            ev.data = { data: [], source: 'remote', error: err.message };
            ev.cancel = true;
          }
        }
      }
    },
    {
      for: 'store:data:ensure',
      on: {
        fn: async function (ev) {
          if (!this._isEnabled()) return;
          const config = this.brick.options.get('store', {});
          const start = ev.data.start || 0;
          const count = ev.data.count || 50;

          const query = {
            url: config.url,
            start: start,
            count: count
          };

          try {
            const result = await this._fetchData(query);
            let items = [];

            if (Array.isArray(result)) {
              items = result;
            } else if (result && result.data && Array.isArray(result.data)) {
              items = result.data;
              const total = result.total || result.totalCount || result.count;
              if (total && total !== this.brick.store.count()) {
                this.brick.options.setSilent('store.totalCount', total);
              }
            }

            this.brick.store.set(items, start);
          } catch (err) {
            console.error('[store-remote] Range load failed:', err);
          }
        }
      }
    }
  ],

  init: function () {
    // Remote strategy initialized
  },

  destroy: function () {
    // Cleanup if needed
  }
};

export default storeRemote;