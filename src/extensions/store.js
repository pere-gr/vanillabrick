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
  { code: '21', name: 'twenty-one', key: 21 },
  { code: '22', name: 'twenty-two', key: 22 },
  { code: '23', name: 'twenty-three', key: 23 },
  { code: '24', name: 'twenty-four', key: 24 },
  { code: '25', name: 'twenty-five', key: 25 },
  { code: '26', name: 'twenty-six', key: 26 },
  { code: '27', name: 'twenty-seven', key: 27 },
  { code: '28', name: 'twenty-eight', key: 28 },
  { code: '29', name: 'twenty-nine', key: 29 },
  { code: '30', name: 'thirty', key: 30 },
  { code: '31', name: 'thirty-one', key: 31 },
  { code: '32', name: 'thirty-two', key: 32 },
  { code: '33', name: 'thirty-three', key: 33 },
  { code: '34', name: 'thirty-four', key: 34 },
  { code: '35', name: 'thirty-five', key: 35 },
  { code: '36', name: 'thirty-six', key: 36 },
  { code: '37', name: 'thirty-seven', key: 37 },
  { code: '38', name: 'thirty-eight', key: 38 },
  { code: '39', name: 'thirty-nine', key: 39 },
  { code: '40', name: 'forty', key: 40 },
  { code: '41', name: 'forty-one', key: 41 },
  { code: '42', name: 'forty-two', key: 42 },
  { code: '43', name: 'forty-three', key: 43 },
  { code: '44', name: 'forty-four', key: 44 },
  { code: '45', name: 'forty-five', key: 45 },
  { code: '46', name: 'forty-six', key: 46 },
  { code: '47', name: 'forty-seven', key: 47 },
  { code: '48', name: 'forty-eight', key: 48 },
  { code: '49', name: 'forty-nine', key: 49 },
  { code: '50', name: 'fifty', key: 50 },
  { code: '51', name: 'fifty-one', key: 51 },
  { code: '52', name: 'fifty-two', key: 52 },
  { code: '53', name: 'fifty-three', key: 53 },
  { code: '54', name: 'fifty-four', key: 54 },
  { code: '55', name: 'fifty-five', key: 55 },
  { code: '56', name: 'fifty-six', key: 56 },
  { code: '57', name: 'fifty-seven', key: 57 },
  { code: '58', name: 'fifty-eight', key: 58 },
  { code: '59', name: 'fifty-nine', key: 59 },
  { code: '60', name: 'sixty', key: 60 },
  { code: '61', name: 'sixty-one', key: 61 },
  { code: '62', name: 'sixty-two', key: 62 },
  { code: '63', name: 'sixty-three', key: 63 },
  { code: '64', name: 'sixty-four', key: 64 },
  { code: '65', name: 'sixty-five', key: 65 },
  { code: '66', name: 'sixty-six', key: 66 },
  { code: '67', name: 'sixty-seven', key: 67 },
  { code: '68', name: 'sixty-eight', key: 68 },
  { code: '69', name: 'sixty-nine', key: 69 },
  { code: '70', name: 'seventy', key: 70 },
  { code: '71', name: 'seventy-one', key: 71 },
  { code: '72', name: 'seventy-two', key: 72 },
  { code: '73', name: 'seventy-three', key: 73 },
  { code: '74', name: 'seventy-four', key: 74 },
  { code: '75', name: 'seventy-five', key: 75 },
  { code: '76', name: 'seventy-six', key: 76 },
  { code: '77', name: 'seventy-seven', key: 77 },
  { code: '78', name: 'seventy-eight', key: 78 },
  { code: '79', name: 'seventy-nine', key: 79 },
  { code: '80', name: 'eighty', key: 80 },
  { code: '81', name: 'eighty-one', key: 81 },
  { code: '82', name: 'eighty-two', key: 82 },
  { code: '83', name: 'eighty-three', key: 83 },
  { code: '84', name: 'eighty-four', key: 84 },
  { code: '85', name: 'eighty-five', key: 85 },
  { code: '86', name: 'eighty-six', key: 86 },
  { code: '87', name: 'eighty-seven', key: 87 },
  { code: '88', name: 'eighty-eight', key: 88 },
  { code: '89', name: 'eighty-nine', key: 89 },
  { code: '90', name: 'ninety', key: 90 },
  { code: '91', name: 'ninety-one', key: 91 },
  { code: '92', name: 'ninety-two', key: 92 },
  { code: '93', name: 'ninety-three', key: 93 },
  { code: '94', name: 'ninety-four', key: 94 },
  { code: '95', name: 'ninety-five', key: 95 },
  { code: '96', name: 'ninety-six', key: 96 },
  { code: '97', name: 'ninety-seven', key: 97 },
  { code: '98', name: 'ninety-eight', key: 98 },
  { code: '99', name: 'ninety-nine', key: 99 },
  { code: '100', name: 'one hundred', key: 100 },
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

