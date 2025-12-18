export const gridRows = {
  for: [{ host: 'brick', kind: 'grid' }],
  requires: ['dom', 'store', 'columns'],
  ns: 'rows',
  options: {},

  brick: {
    render: function () {
      const root = this.dom.element();
      if (!root) return;

      const table = root.tagName && root.tagName.toLowerCase() === 'table'
        ? root
        : root.querySelector && root.querySelector('table');
      if (!table) return;

      const columns = this.columns.get();
      const rows = this.store.load();

      let tbody = (table.tBodies && table.tBodies.length)
        ? table.tBodies[0]
        : table.querySelector('tbody');
      if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
      }
      tbody.innerHTML = '';

      for (let r = 0; r < rows.length; r += 1) {
        const record = rows[r] || {};
        const tr = document.createElement('tr');
        for (let c = 0; c < columns.length; c += 1) {
          const col = columns[c] || {};
          const field = col.datafield;
          const td = document.createElement('td');
          td.textContent = (field && record[field] !== undefined && record[field] !== null)
            ? record[field]
            : '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
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
    }
  ],

  init: function () { },

  destroy: function () { }
};


export default gridRows;

