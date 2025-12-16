VanillaBrick.extensions.rowsFocused = {
  for: [{ host: 'brick', kind: 'grid' }],
    requires: ['dom', 'rows', 'store'],
    ns: 'rowsFocused',
    options: {},

    brick: {},

    extension: {
        _addTabIndex: function () {
            const el = this.brick.dom.element();
            if (!el) return;
            const rows = el.querySelectorAll('tbody tr') || [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row.hasAttribute('tabindex')) {
                    row.setAttribute('tabindex', i);
                }
            }
        },
        _handleFocus: function (target) {
            const el = this.brick.dom.element();
            if (!el) return;
            const row = target.closest('tr');
            if (!row) return;
            const old = el.querySelector('tr.vb-focused');
            if (old) old.classList.remove('vb-focused');
            row.classList.add('vb-focused');
            const rowIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
            const data = this.brick.store.get(rowIndex);
            this.brick.events.fire('dom:row:focus', {
                index: rowIndex,
                row: data,
                element: row
            });
        }
    },

    events: [
        {
            for: 'brick:status:ready',
            on: {
                fn: function () {
                    const el = this.brick.dom.element();
                    if (el) {
                        const self = this;
                        el.addEventListener('focusin', function (e) {
                            self._handleFocus(e.target);
                        });
                    }
                    this._addTabIndex();
                }
            }
        },
        {
            for: 'store:data:set',
            after: {
                fn: function () {
                    this._addTabIndex();
                }
            }
        },
        {
            for: 'store:data:sort',
            after: {
                fn: function () {
                    this._addTabIndex();
                }
            }
        }
    ],

    init: function () { },

    destroy: function () { }
};
