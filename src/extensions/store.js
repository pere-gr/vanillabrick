const DATA_SAMPLE_ROWS = [
  { code: '1', name: 'one', key: 1 },
  { code: '2', name: 'two', key: 2 },
  { code: '3', name: 'three', key: 3 },
  { code: '4', name: 'four', key: 4 },
  { code: '5', name: 'five', key: 5 },
  { code: '6', name: 'six', key: 6 },
  { code: '7', name: 'seven', key: 7 },
  { code: '8', name: 'eight', key: 8 },
  { code: '9', name: 'nine', key: 9 },
  { code: '10', name: 'ten', key: 10 },
  { code: '11', name: 'eleven', key: 11 },
  { code: '12', name: 'twelve', key: 12 },
  { code: '13', name: 'thirteen', key: 13 },
  { code: '14', name: 'fourteen', key: 14 },
  { code: '15', name: 'fifteen', key: 15 },
  { code: '16', name: 'sixteen', key: 16 },
  { code: '17', name: 'seventeen', key: 17 },
  { code: '18', name: 'eighteen', key: 18 },
  { code: '19', name: 'nineteen', key: 19 },
  { code: '20', name: 'twenty', key: 20 },
];

export const store = {
  for: [
    { host: 'brick', kind: 'form' },
    { host: 'brick', kind: 'table' }
  ],
  requires: [],
  ns: 'store',
  options: {},

  // API pública sobre el brick (this === brick)
  brick: {
    load: function () {
      return this.brick.options.get('store.data', []);
    },
    set: function (data) {
      if (data === null) return;
      const previous = this.brick.options.get('store.data', []);
      data = Array.isArray(data) ? data.slice() : [data];

      this.brick.events.fire('store:data:set', {
        previous: previous,
        data: data
      });

      return data;
    },
    setAsync: async function (data) {
      const previous = this.brick.options.get('store.data', []);
      data = Array.isArray(data) ? data.slice() : [];

      await this.brick.events.fireAsync('store:data:set', {
        previous: previous,
        data: data
      });

      return data;
    },
    all: function () {
      return this.brick.store.load();
    },
    get: function (index) {
      const arr = this.brick.store.load();
      if (typeof index !== 'number') return null;
      if (index < 0 || index >= arr.length) return null;
      return arr[index];
    }
  },

  // Helpers interns (this === ext)
  extension: {
    _normalizeArray: function (value, fallback) {
      if (Array.isArray(value)) return value.slice();
      return Array.isArray(fallback) ? fallback.slice() : [];
    },
    _sortRows: function (rows, field, dir, compareFn) {
      const arr = Array.isArray(rows) ? rows.slice() : [];
      const cmp = typeof compareFn === 'function'
        ? function (a, b) { return compareFn(a, b, dir); }
        : function (a, b) {
          const va = a && Object.prototype.hasOwnProperty.call(a, field) ? a[field] : undefined;
          const vb = b && Object.prototype.hasOwnProperty.call(b, field) ? b[field] : undefined;
          let res = 0;
          if (va === vb) res = 0;
          else if (va === undefined || va === null) res = -1;
          else if (vb === undefined || vb === null) res = 1;
          else if (typeof va === 'number' && typeof vb === 'number') res = va - vb;
          else res = String(va).localeCompare(String(vb));
          return dir === 'desc' ? -res : res;
        };
      arr.sort(cmp);
      return arr;
    }
  },

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function (ev) {
          //const storeData = this.brick.options.get('store:data', null);
          const storeData = this._normalizeArray(DATA_SAMPLE_ROWS, []);
          this.brick.options.setSilent('store.data', storeData);
        }
      }
    },
    {
      for: 'store:data:set',
      on: {
        fn: function (ev) {
          const payload = (ev && ev.data) || null;
          const data = payload && payload.data ? payload.data : [];
          this.brick.options.setSilent('store.data', data);
        }
      }
    },
    {
      for: 'store:data:sort',
      on: {
        fn: function (ev) {
          const payload = (ev && ev.data) || {};

          const field = payload.field || null;
          const dir = payload.dir || 'asc';

          if (!field || !this.brick) return;
          const sorted = this._sortRows(this.brick.store.load(), field, dir, payload.compare);
          this.brick.options.setSilent("store.data", sorted);
          ev.field = field;
          ev.dir = dir;
          ev.data = sorted;
        }
      }
    }
  ],

  init: function () { },

  destroy: function () { }
};


export default store;

