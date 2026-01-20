export const tableRowsFocused = {
    for: [{ host: 'brick', kind: 'table' }],
    requires: ['html', 'rows', 'store'],
    ns: 'rowsFocused',
    options: {},

    brick: {},

    extension: {
        /* _addTabIndex: function () {
             const el = this.brick.html.element();
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
             const el = this.brick.html.element();
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
         }*/
    },

    events: [
        {
            // Per-row render
            for: 'table:row:render',
            before: {
                fn: function (ev) {
                    const html = this.brick.html;
                    const tr = ev.data.tr;
                    if (tr == null) return;
                    html.off(tr, "mousedown");
                }
            },
            after: {
                fn: function (ev) {
                    const html = this.brick.html;
                    const tr = ev.data.tr;
                    const rowData = ev.data.row;
                    const uidField = this.brick.store.uidField();
                    const focusedId = this.brick.options.get('table.focusedId');

                    // Restore focus visual if this is the focused row
                    if (focusedId !== undefined && rowData[uidField] === focusedId) {
                        this.brick.css.addClass(tr, "vb-focused");
                    }

                    html.on(tr, "mousedown", (e) => {
                        const root = this.brick.html.element();
                        root.querySelectorAll("tr.vb-focused").forEach(el => {
                            if (el !== tr) this.brick.css.removeClass(el, "vb-focused");
                        });
                        this.brick.css.addClass(tr, "vb-focused");

                        // Save state
                        this.brick.options.set('table.focusedId', rowData[uidField]);

                        this.brick.wire?.notify('dom:row:focus', { row: rowData, uidField: uidField });
                    });
                }
            }
        },
    ],

    init: function () { },

    destroy: function () { }
};

export default tableRowsFocused;

