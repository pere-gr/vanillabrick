export const tableRows = {
  for: [{ host: 'brick', kind: 'table' }],
  requires: ['html', 'store', 'columns'],
  ns: 'rows',
  options: {},

  brick: {
    render: function () {
      const html = this.brick.html;
      const root = html.element();
      if (!root) return;
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      const rows = this.brick.store.load();
      const columns = this.brick.columns.get();
      // Fire render pipeline
      this.brick.events.fireAsync('table:render:rows', { rows: rows, columns: columns }).then(() => {
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const ms = Math.round(t1 - t0);
        console.warn('table rows pipeline time', ms, 'ms');
      });
    }
  },

  extension: {},

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function () {
          this.brick.rows.render();
        }
      }
    },
    {
      for: 'store:data:*',
      after: {
        fn: function (ev) {
          this.brick.rows.render();
        }
      }
    },
    {
      // Manage full rows render pipeline
      for: 'table:render:rows',
      before: {
        fn: function (ev) {
          const html = this.brick.html;
          const root = html.element && html.element();
          if (!root) return;
          ev.data = ev.data || {};

          // Ensure rows/columns available to downstream phases
          ev.data.rows = Array.isArray(ev.data.rows) ? ev.data.rows : this.brick.store.load();
          ev.data.columns = Array.isArray(ev.data.columns) ? ev.data.columns : this.brick.columns.get();

          const table = root.tagName && root.tagName.toLowerCase() === 'table'
            ? root
            : (html.get && html.get('table')) || (root.querySelector && root.querySelector('table'));
          if (!table) return;

          // Prepare old/new tbody and pool of existing trs
          const oldTbody = html.detach(table.querySelector('tbody')); /*(table.tBodies && table.tBodies.length)
            ? table.tBodies[0]
            : table.querySelector && table.querySelector('tbody');*/
          const newTbody = html.create('tbody');

          ev.data.table = table;
          ev.data.oldTbody = oldTbody;
          ev.data.tbody = newTbody;
          ev.data.frag = html.frag() || newTbody.ownerDocument.createDocumentFragment();
        }
      },
      on: {
        fn: function (ev) {
          const data = ev.data || {};
          const rows = Array.isArray(ev && ev.data && ev.data.rows) ? ev.data.rows : this.brick.store.load();
          const columns = Array.isArray(ev && ev.data && ev.data.columns) ? ev.data.columns : this.brick.columns.get();
          data.columns = columns;
          data.rows = rows;
          for (let i = 0; i < rows.length; i += 1) {
            const rowData = rows[i] || {};
            this.brick.events.fire('table:render:row', {
              row: rowData,
              rowIndex: i,
              oldTbody: data.oldTbody,
              frag: data.frag,
              tbody: ev.data.tbody,
              columns: columns
            });
          }
        }
      },
      after: {
        fn: function (ev) {
          const data = ev.data || {};
          const html = this.brick.html;
          const tbody = data.tbody;
          if (!tbody) return;

          // Append assembled fragment
          /*if (data.frag) {
            html.append(tbody, data.frag);
          }*/

          html.append(data.table,tbody);
          return;
          // Replace old tbody with new
          if (data.table) {
            const table = data.table;
            if (data.oldTbody && data.oldTbody.parentNode === table) {
              table.replaceChild(tbody, data.oldTbody);
            } else {
              html.append(table, tbody);
            }
          }
        }
      }
    },
    {
      // Per-row render
      for: 'table:render:row',
      before: {
        fn: function (ev) {
          const html = this.brick.html;
          let tr = null;
          // Reuse from old tbody if available
          const oldTbody = ev.data && ev.data.oldTbody;
          if (oldTbody && oldTbody.firstChild) {
            tr = oldTbody.firstChild;
            oldTbody.removeChild(tr);
          }
          if (!tr) tr = html.create('tr');
          
          ev.data.tr = tr;
        }
      },
      on: {
        fn: function (ev) {
          const html = this.brick.html;
          const tr = ev.data.tr;
          const row = ev.data.row || {};
          const columns = ev.data.columns || [];
          html.attr(tr,"key", row.key);
          for (let c = 0; c < columns.length; c += 1) {
            const col = columns[c] || {};
            this.brick.events.fire('table:render:col', {
              tr: tr,
              tdIndex: c,
              column: col,
              row: row,
              rowIndex: ev.data.rowIndex
            });
          }
        }
      },
      after: {
        fn: function (ev) {
          const html = this.brick.html;
          const tr = ev.data.tr;
          const tbody = ev.data.tbody;
          if (tbody && tr) {
            html.append(tbody, tr);
          }
        }
      }
    },
    {
      // Per-column render
      for: 'table:render:col',
      before: {
        fn: function (ev) {
          const html = this.brick.html;
          const tr = ev.data.tr;
          const idx = ev.data.tdIndex;
          if (!tr) return;
          let td = (tr.cells && tr.cells[idx]) ? tr.cells[idx] : null;
          if (!td) {
            td = html.create('td');
            // insert at correct position
            if (tr.cells && idx < tr.cells.length) {
              tr.insertBefore(td, tr.cells[idx]);
            } else {
              html.append(tr, td);
            }
          }
          ev.data.td = td;
        }
      },
      on: {
        fn: function (ev) {
          const td = ev.data.td;
          const col = ev.data.column || {};
          const row = ev.data.row || {};
          const field = col.datafield;
          const val = (field && Object.prototype.hasOwnProperty.call(row, field)) ? row[field] : '';
          if (td) {
            td.textContent = (val === undefined || val === null) ? '' : val;
          }
        }
      },
      after: {
        fn: function () { }
      }
    }
  ],

  init: function () { },

  destroy: function () { }
};

export default tableRows;
