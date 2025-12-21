export const table = {
  for: [{ host: 'brick', kind: 'table' }],
  requires: ['html'],
  ns: 'table',
  options: {},

  brick: {
    refresh: function () {
      if (this.__tableExt) this.__tableExt._refreshRows();
    },
    getSelection: function () {
      const ext = this.__tableExt;
      if (!ext) return { index: -1, row: null };
      const idx = (typeof ext.selectedIndex === 'number') ? ext.selectedIndex : -1;
      const row = (idx >= 0 && ext.rows && ext.rows[idx]) ? ext.rows[idx] : null;
      return { index: idx, row: row };
    },
    clearSelection: function () {
      if (this.__tableExt) this.__tableExt._setSelectedIndex(-1);
    }
  },

  extension: {
    table: null,
    rows: [],
    selectedIndex: -1,
    _findTable: function () {
      const root = this.brick.html && typeof this.brick.html.element === 'function'
        ? this.brick.html.element()
        : null;
      if (!root || !root.querySelector) {
        this.table = null;
        return null;
      }
      const table =
        root.querySelector('table.vb-table') ||
        root.querySelector('table');
      this.table = table || null;
      return this.table;
    },
    _refreshRows: function () {
      const table = this.table || this._findTable();
      if (!table) {
        this.rows = [];
        this.selectedIndex = -1;
        return;
      }
      const body = (table.tBodies && table.tBodies.length)
        ? table.tBodies[0]
        : table.querySelector('tbody');
      const rows = body ? body.rows : table.rows;
      this.rows = Array.prototype.slice.call(rows || []);
      if (this.selectedIndex >= this.rows.length) {
        this.selectedIndex = -1;
      }
    },
    _setSelectedIndex: function (index) {
      const rows = this.rows || [];
      if (!rows.length) {
        this.selectedIndex = -1;
        return;
      }
      if (typeof index !== 'number' || index < 0 || index >= rows.length) {
        index = -1;
      }
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || !row.classList) continue;
        if (i === index) row.classList.add('selected');
        else row.classList.remove('selected');
      }
      this.selectedIndex = index;
    }
  },

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function () {
          this._findTable();
          this._refreshRows();
        }
      }
    },
    {
      for: 'dom:click:*',
      on: {
        fn: function (ev) {
          const table = this.table || this._findTable();
          if (!table) return;
          if (!ev || !ev.data || !ev.data.domEvent) return;
          const target = ev.data.domEvent.target;
          if (!target) return;

          let node = target;
          let clickedRow = null;
          while (node && node !== table) {
            if (node.tagName && node.tagName.toLowerCase() === 'tr') {
              clickedRow = node;
              break;
            }
            node = node.parentNode;
          }
          if (!clickedRow) return;

          this._refreshRows();
          const rows = this.rows || [];
          const index = rows.indexOf(clickedRow);
          if (index === -1) return;
          if (this.selectedIndex === index) this._setSelectedIndex(-1);
          else this._setSelectedIndex(index);
        }
      }
    }
  ],

  init: function () {
    this.brick.__tableExt = this;
    this.table = null;
    this.rows = [];
    this.selectedIndex = -1;
    return true;
  },

  destroy: function () {
    this.rows = [];
    this.table = null;
    this.selectedIndex = -1;
    if (this.brick) {
      delete this.brick.__tableExt;
    }
  }
};





export default table;

