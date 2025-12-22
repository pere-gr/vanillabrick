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

      this.brick.events.fire('table:rows:data', { rows: rows, columns: columns });

      // Fire render pipeline
      this.brick.events.fire('table:rows:render', { rows: rows, columns: columns });
    }
  },

  extension: {},

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function (ev) {
          console.log("what happened?", ev.event.name);
          this.brick.rows.render();
        }
      }
    },
    {
      for: 'store:data:*',
      after: {
        fn: function (ev) {
          console.log("what happened?", ev.event.name);
          this.brick.rows.render();
        }
      }
    },
    {
      for: 'table:rows:render',
      before: {
        priority:0,
        fn:function(ev){
          const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

          const html = this.brick.html;
          const items = this.brick.options.get("table.rows") || {};
          const rows = Array.isArray(ev.data.rows) ? ev.data.rows : this.brick.store.load();
          const columns = Array.isArray(ev.data.columns) ? ev.data.columns : this.brick.columns.get();

          for (let i = 0; i < rows.length; i++){
            let item = items[rows[i].key];
            if (item == null){
              item = {};
              items[rows[i].key] = item ;
            }

            item.row = rows[i];
            let tr = item.tr || null;
            if (tr == null){
              tr = html.create('tr');
              html.attr(tr,'for',item.row.key);
              items[item.row.key].tr = tr;
            }

            for(c = 0; c < columns.length; c++){
              let td = tr.children.length > 0 ? tr.children[c] : null;
              if (td == null){
                td = html.create('td');
                html.append(tr,td);
              }
              html.attr(td,'for',columns[c].datafield);
              html.setSafe(td,item.row[columns[c].datafield])
            }
            
          }
          this.brick.options.setSilent("table.rows",items);
          const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const ms = Math.round(t1 - t0);
          console.warn('data created in...', ms, 'ms');
        }
      }
    },    
    {
      // Manage full rows render pipeline
      for: 'table:rows:render',
      before: {
        fn: function (ev) {
          const html = this.brick.html;
          const root = html.element && html.element();
          const items = this.brick.options.get("table.rows");
          const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

          if (!root) return;
          ev.data = ev.data || {};
          ev.data.t0 = t0;
          // Ensure rows/columns available to downstream phases
          ev.data.items = items;
          ev.data.rows = Array.isArray(ev.data.rows) ? ev.data.rows : this.brick.store.load();
          ev.data.columns = Array.isArray(ev.data.columns) ? ev.data.columns : this.brick.columns.get();

          const table = root.tagName && root.tagName.toLowerCase() === 'table'
            ? root
            : (html.get && html.get('table')) || (root.querySelector && root.querySelector('table'));
          if (!table) return;

          // Prepare old/new tbody and pool of existing trs
          const tbody = html.detach(table.querySelector('tbody'));
          for (i = tbody.children.length; i >= 0 ; i--){
            html.detach(tbody.children[i]);
          }

          ev.data.table = table;
          ev.data.tbody = tbody;
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
            const item = ev.data.items[rows[i].key];
            const rowData = rows[i] || {};
            this.brick.events.fire('table:row:render', {
              item: item,
              row: rowData,
              rowIndex: i,
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
          requestAnimationFrame(() => {
                    html.append(data.table,tbody);
          });

          const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const ms = Math.round(t1 - ev.data.t0);
        console.warn('table rows pipeline time', ms, 'ms');
          //html.append(data.table,tbody);
        }
      }
    },
    {
      // Per-row render
      for: 'table:row:render',
      before: {
        fn: function (ev) {
          const html = this.brick.html;
          const tr = ev.data.item.tr;
          ev.data.tr = tr;
        }
      },
      on: {
        fn: function (ev) {
          /*const html = this.brick.html;
          const tr = ev.data.tr;
          const row = ev.data.row || {};
          const columns = ev.data.columns || [];
          html.attr(tr,"for", row.key);
          for (let c = 0; c < columns.length; c += 1) {
            const col = columns[c] || {};
            this.brick.events.fire('table:col:render', {
              tr: tr,
              tdIndex: c,
              column: col,
              row: row,
              rowIndex: ev.data.rowIndex
            });
          }*/
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
      for: 'table:col:render',
      before: {
        fn: function (ev) {
          const html = this.brick.html;
          const tr = ev.data.tr;
          const column = ev.data.column;
          const row = ev.data.row;
          if (!tr) return;
          let td = html.get('[for="' + column.datafield + '"]',tr);
          if (!td) {
            td = html.create('td');
            html.attr(td,'for',column.datafield);
            html.append(tr, td);
          }
          html.setSafe(td,row[column.datafield]);
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
