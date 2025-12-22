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
        fn: function (ev) {
          const columns = this.brick.columns.get();
          const html = this.brick.html;
          const root = html.element && html.element();
          if (!root) return;

          const table = root.tagName && root.tagName.toLowerCase() === 'table'
            ? root
            : (html.get && html.get('table')) || (root.querySelector && root.querySelector('table'));
          if (!table) return;

          // Build thead in-memory; attach in 'after'
          const thead = html.create('thead');
          const row = thead.insertRow();
          const brick = this.brick;

          for (let i = 0; i < columns.length; i += 1) {
            const col = columns[i] || {};
            const th = html.create('th', { text: col.label || col.datafield || '' });
            if (col.sortable && col.datafield) {
              th.classList.add('vb-sortable');
              html.on(th, 'click', (function (colDef) {
                return function () {
                  brick.columns.sort(colDef.datafield, null);
                };
              })(col));
            }
            html.append(row, th);
          }

          // Pass along to after phase
          if (!ev.data) ev.data = {};
          ev.data.table = table;
          ev.data.thead = thead;
        }
      },
      after: {
        fn: function (ev) {
          const html = this.brick.html;
          const table = (ev && ev.data && ev.data.table) || (html.get && html.get('table')) || null;
          const thead = ev && ev.data && ev.data.thead;
          if (!table || !thead) return;

          const existing = table.tHead || table.querySelector && table.querySelector('thead');
          if (existing && existing !== thead && existing.parentNode === table) {
            table.removeChild(existing);
          }
          table.insertBefore(thead, table.firstChild || null);
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
        { datafield: 'key', label: 'Key', sortable: false },
      ]
    }
  }
};



export default tableColumns;

