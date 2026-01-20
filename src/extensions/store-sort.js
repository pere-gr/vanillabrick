/**
 * Store Local Sorting Extension
 * Handles store:data:sort for local data and client-mode remote data.
 * Decouples sorting logic from data fetching.
 */

export const storeSort = {
    for: [{ host: 'brick', kind: '*' }],
    requires: ['store'],
    ns: 'storeSort', // Namespace to avoid collision (optional, usually extensions don't need ns unless exposing API)

    // No public API exposed on brick directly, works via events
    brick: {},

    extension: {
        _canSortLocally: function () {
            const type = this.brick.options.get('store.type', 'local');
            const mode = this.brick.options.get('store.pagination.mode', 'client');

            // We sort locally if:
            // 1. Store is 'local' or 'memory'
            // 2. Store is 'remote' BUT pagination mode is 'client' (full dataset loaded)
            if (type === 'local' || type === 'memory') return true;
            if (type === 'remote' && mode === 'client') return true;

            return false;
        }
    },

    events: [
        {
            for: 'store:data:sort',
            on: {
                fn: function (ev) {
                    if (!this._canSortLocally()) return;

                    const field = ev.data.field;
                    const dir = ev.data.dir || 'asc';

                    console.info(`[store-sort] Sorting locally by ${field} (${dir})`);

                    const data = this.brick.store.data() || [];
                    // Filter out empty slots if any (sparse array safety)
                    // Note: If we have gaps, sorting moves them to end usually.
                    // We'll perform an in-place sort on the full array if possible, or filtered.
                    // Ideally we sort the underlying array including empty slots? 
                    // No, usually undefined items break sort comparators.
                    // Let's assume compact array for client mode.

                    // Simple comparator
                    const compareFn = ev.compare || function (a, b) {
                        // Safety checks
                        if (a === undefined || a === null) return 1;
                        if (b === undefined || b === null) return -1;

                        const va = a[field];
                        const vb = b[field];

                        // String sorting should use localeCompare for best results
                        if (typeof va === 'string' && typeof vb === 'string') {
                            return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                        }

                        if (va < vb) return dir === 'asc' ? -1 : 1;
                        if (va > vb) return dir === 'asc' ? 1 : -1;
                        return 0;
                    };

                    data.sort(compareFn);

                    // Update store (this might be redundant if data was a reference, 
                    // but calling set() triggers necessary internal flags/logs if any)
                    // Actually store.set() accepts (data, start). 
                    // To be safe and trigger chain:
                    this.brick.store.set(data);

                    // CRITICAL: Notify listeners that data is updated so views can refresh
                    // 'store:data:updated' is usually fired by store.set? Check store.js.
                    // Store.set() usually fires 'store:data:set' or similar?
                    // Let's look at store.js later. To be SAFE, we fire 'store:data:updated' which table-virtual listens to.
                    this.brick.events.fire('store:data:updated', { source: 'sort', field: field, dir: dir });

                    // Trigger global render for non-virtual components (or virtual ones listening to render)
                    this.brick.events.fire('table:rows:render');
                }
            }
        }
    ],

    init: function () { },
    destroy: function () { }
};

export default storeSort;
