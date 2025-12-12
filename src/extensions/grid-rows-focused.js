VanillaBrick.extensions.rowsFocused = {
    for: ['grid'],
    requires: ['dom', 'rows', 'store'],
    ns: 'rowsFocused',
    options: {},

    brick: {},

    extension: {},

    events: [
        {
            for: 'brick:ready:*',
            on: {
                fn: function () {
                    const brick = this.brick;
                    const root = brick.dom.element();

                    // Define logic locally to avoid context issues
                    function addTabIndex() {
                        const el = brick.dom.element();
                        if (!el) return;
                        const rows = el.querySelectorAll('tbody tr') || [];
                        for (let i = 0; i < rows.length; i++) {
                            const row = rows[i];
                            if (!row.hasAttribute('tabindex')) {
                                row.setAttribute('tabindex', '0');
                            }
                        }
                    }

                    function handleFocus(target) {
                        const row = target.closest('tr');
                        if (!row) return;

                        const el = brick.dom.element();
                        const old = el.querySelector('tr.vb-focused');
                        if (old) old.classList.remove('vb-focused');
                        row.classList.add('vb-focused');

                        const rowIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
                        const data = brick.store.get(rowIndex);

                        brick.events.fire('dom:row:focus', {
                            index: rowIndex,
                            row: data,
                            element: row
                        });
                    }

                    // Attach listener
                    if (root) {
                        root.addEventListener('focusin', function (e) {
                            handleFocus(e.target);
                        });
                    }

                    // Run initial
                    addTabIndex();

                    // Store reference for other handlers? 
                    // We can't easily share with other events without `this`.
                    // But other events just need addTabIndex.
                    // Let's rely on the method existing on `this` for safely?
                    // No, let's redefine addTabIndex in the other handlers or attach it to the brick instance temporarily? 
                    // Actually, defining it on `this` manually is safe if WE do it.
                    this._safeAddTabIndex = addTabIndex;
                }
            }
        },
        {
            for: 'store:data:set',
            after: {
                fn: function () {
                    // Use the safe reference we attached, or assume `this._safeAddTabIndex` works?
                    // If `this` is consistent across events, it works.
                    // If not, we re-implement. It's short.
                    const brick = this.brick;
                    const el = brick.dom.element();
                    if (!el) return;
                    const rows = el.querySelectorAll('tbody tr') || [];
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row.hasAttribute('tabindex')) {
                            row.setAttribute('tabindex', i);
                        }
                    }
                }
            }
        },
        {
            for: 'store:data:sort',
            after: {
                fn: function () {
                    const brick = this.brick;
                    const el = brick.dom.element();
                    if (!el) return;
                    const rows = el.querySelectorAll('tbody tr') || [];
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row.hasAttribute('tabindex')) {
                            row.setAttribute('tabindex', i);
                        }
                    }
                }
            }
        }
    ],

    init: function () { },

    destroy: function () { }
};
