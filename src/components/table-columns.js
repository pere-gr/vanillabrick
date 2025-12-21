export const tableColumns = {
  for: [{ host: 'brick', kind: 'table' }],
  requires: ['html', 'store'],
  ns: 'columns',

  brick: {
    get: function () {
      return this.options.get("table.columns", []);
    },
    sort: function (field, dir) {
      const cols = this.brick.columns.get();
      const colDef = cols.find(function (c) { return c && c.datafield === field; }) || {};
      const state = this.options.get("table.sort", { field: null, dir: null });
      let nextDir = dir;
      if (nextDir !== 'asc' && nextDir !== 'desc') {
        nextDir = (state.field === field && state.dir === 'asc') ? 'desc' : 'asc';
      }

      this.events.fire('store:data:sort', {
        field: field,
        dir: nextDir,
        compare: typeof colDef.sort === 'function' ? colDef.sort : null
      });

      return nextDir;
    }
  },

  extension: {},

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function () {
          const columns = this.brick.columns.get();
          const root = this.brick.html.element && this.brick.html.element();
          if (!root) return;

          const table = root.tagName && root.tagName.toLowerCase() === 'table'
            ? root
            : root.querySelector && root.querySelector('table');
          if (!table) return;

          let thead = (table.tHead) ? table.tHead : table.querySelector('thead');
          if (!thead) {
            thead = table.createTHead ? table.createTHead() : table.insertBefore(document.createElement('thead'), table.firstChild);
          }

          const row = thead.rows && thead.rows[0] ? thead.rows[0] : thead.insertRow();
          row.innerHTML = '';
          const brick = this.brick;
          for (let i = 0; i < columns.length; i += 1) {
            const col = columns[i] || {};
            const th = document.createElement('th');
            th.textContent = col.label || col.datafield || '';
            if (col.sortable && col.datafield) {
              th.classList.add('vb-sortable');
              th.addEventListener('click', (function (colDef) {
                return function () {
                  brick.columns.sort(colDef.datafield, null);
                };
              })(col));
            }
            row.appendChild(th);
          }
        }
      }
    },
    {
      for: 'store:data:sort',
      after: {
        fn: function (ev) {
          this.brick.options.setSilent("table.sort", { field: ev.field, dir: ev.dir || 'asc' });
        }
      }
    }
  ],

  init: function () { },

  destroy: function () { },

  options: {
    table: {
      columns: [
        { datafield: 'code', label: 'Code', sortable: true },
        { datafield: 'name', label: 'Name', sortable: true },
      ]
    }
  }
};



export default tableColumns;

