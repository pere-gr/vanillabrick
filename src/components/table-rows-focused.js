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
                before:{
                    fn: function(ev){
                        const html = this.brick.html;
                        const tr = ev.data.tr;
                        html.off(tr,"mousedown");
                    }
                },
                after:{
                    fn: function(ev){
                        const html = this.brick.html;
                        const tr = ev.data.tr;
                        html.on(tr,"mousedown",(e)=>{
                           const root = this.brick.html.element(); // o la table/tbody si tens la ref
                            root.querySelectorAll("tr.vb-focused").forEach(el => {
                                if (el !== tr) this.brick.css.removeClass(el, "vb-focused");
                            });
                            this.brick.css.addClass(tr, "vb-focused");
                            this.brick.wire?.notify('dom:row:focus', {row:ev.data.row});
                        });
                    }
                }
            },
    ],

    init: function () { },

    destroy: function () { }
};

export default tableRowsFocused;

