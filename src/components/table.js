/**
 * Table Extension (Core)
 * Manages table selection and row state for table bricks.
 */
export const table = {
  for: [{ host: 'brick', kind: 'table' }],
  requires: ['html'],
  ns: 'table',
  options: {},

  /**
   * Public Brick API
   */
  brick: {
    /**
     * Refresh the internal rows cache from DOM
     */
    refresh: function () {
      this._refreshRows();
    },

    /**
     * Get current selection state
     * @returns {{ index: number, row: HTMLElement|null }}
     */
    getSelection: function () {
      const idx = (typeof this._selectedIndex === 'number') ? this._selectedIndex : -1;
      const rows = this._rows || [];
      const row = (idx >= 0 && rows[idx]) ? rows[idx] : null;
      return { index: idx, row: row };
    },

    /**
     * Clear current selection
     */
    clearSelection: function () {
      this._setSelectedIndex(-1);
    }
  },

  /**
   * Private extension methods (accessible via this._methodName from brick API)
   */
  extension: {
    // State
    _table: null,
    _rows: [],
    _selectedIndex: -1,

    /**
     * Find and cache the table element
     * @returns {HTMLTableElement|null}
     */
    _findTable: function () {
      const root = this.brick.html && typeof this.brick.html.element === 'function'
        ? this.brick.html.element()
        : null;

      if (!root || !root.querySelector) {
        this._table = null;
        return null;
      }

      const table =
        root.querySelector('table.vb-table') ||
        root.querySelector('table');

      this._table = table || null;
      return this._table;
    },

    /**
     * Refresh the internal row array from DOM
     */
    _refreshRows: function () {
      const table = this._table || this._findTable();
      if (!table) {
        this._rows = [];
        this._selectedIndex = -1;
        return;
      }

      const body = (table.tBodies && table.tBodies.length)
        ? table.tBodies[0]
        : table.querySelector('tbody');

      const rows = body ? body.rows : table.rows;
      this._rows = Array.prototype.slice.call(rows || []);

      if (this._selectedIndex >= this._rows.length) {
        this._selectedIndex = -1;
      }
    },

    /**
     * Set the selected row index and update CSS classes
     * @param {number} index
     */
    _setSelectedIndex: function (index) {
      const rows = this._rows || [];
      if (!rows.length) {
        this._selectedIndex = -1;
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

      this._selectedIndex = index;
    }
  },

  /**
   * Event handlers
   */
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
          const table = this._table || this._findTable();
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
          const rows = this._rows || [];
          const index = rows.indexOf(clickedRow);
          if (index === -1) return;

          if (this._selectedIndex === index) {
            this._setSelectedIndex(-1);
          } else {
            this._setSelectedIndex(index);
          }
        }
      }
    }
  ],

  init: function () {
    // Initialize state on extension context
    this._table = null;
    this._rows = [];
    this._selectedIndex = -1;
    return true;
  },

  destroy: function () {
    this._rows = [];
    this._table = null;
    this._selectedIndex = -1;
  }
};

export default table;
