; (function (global) {
  if (global.VanillaBrick) return;
  global.VanillaBrick = {
    base: {},
    components: {},
    configs:{},
    controllers: {},
    brick: null,
    extensions: {},
    runtime: {},
    services: {},
  };
})(typeof window !== 'undefined' ? window : this);


; (function (VanillaBrick) {
  

/**
 * Brick constructor.
 * @constructor
 * @param {Object} options
 */
function Brick(options) {
  const opts = options && typeof options === 'object' ? Object.assign({}, options) : {};
  opts.id = opts.id || this._nextId();
  opts.host = (opts.host || 'brick').toLowerCase();
  opts.kind = (opts.kind || 'brick').toLowerCase();
  Object.defineProperty(this, 'id', {
    value: opts.id,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, 'host', {
    value: opts.host,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, 'kind', {
    value: opts.kind,
    writable: false,
    configurable: false,
    enumerable: true
  });
  const controllers = Object.freeze({
    status: new VanillaBrick.controllers.status(this),
    runtime: new VanillaBrick.controllers.runtime(this),
    options: new VanillaBrick.controllers.options(this, opts),
    events: new VanillaBrick.controllers.events(this),
    extensions: new VanillaBrick.controllers.extensions(this),
  });
  Object.defineProperty(this, '_controllers', {
    value: controllers,
    writable: false,
    configurable: false,
    enumerable: false
  });

  controllers.extensions.applyAll();
  controllers.status.set('ready', { options: opts });
}

Brick.prototype.destroy = function () {
  this._controllers.status.set('destroyed');
};

Object.defineProperty(Brick, '_idCounter', {
  value: 0,
  writable: true,
  configurable: false,
  enumerable: false
});

Object.defineProperty(Brick.prototype, '_nextId', {
  value: function () {
    Brick._idCounter += 1;
    return 'brick-' + Brick._idCounter;
  },
  writable: false,
  configurable: false,
  enumerable: false
});

VanillaBrick.brick = Brick;

VanillaBrick.extensions.items = {
    for: [{ host: 'brick', kind: 'form' }],
    requires: ['dom'],
    ns: 'items',
    options: {},

    brick: {
        get: function () {
            return this.options.get('form.items', []);
        }
    },

    extension: {
        _parseFromDom: function () {
            const root = this.brick.dom.element();
            if (!root) return [];

            const items = [];
            const groups = root.querySelectorAll('.vb-form-group');

            for (let i = 0; i < groups.length; i++) {
                const groupEl = groups[i];
                const group = {
                    type: 'group',
                    items: []
                };

                // Check structure inside group
                const fields = groupEl.querySelectorAll('.vb-form-field');
                for (let j = 0; j < fields.length; j++) {
                    const fieldEl = fields[j];
                    const input = fieldEl.querySelector('input, select, textarea');
                    const label = fieldEl.querySelector('label');

                    if (input) {
                        const fieldItem = {
                            type: 'field',
                            name: input.name || input.id,
                            label: label ? label.textContent : '',
                            controlType: input.tagName.toLowerCase(),
                            inputType: input.type,
                            required: input.required,
                            placeholder: input.placeholder,
                            // Detect span from parent column if exists
                            span: this._detectSpan(fieldEl)
                        };
                        group.items.push(fieldItem);
                    }
                }
                items.push(group);
            }
            return items;
        },

        _detectSpan: function (el) {
            let current = el;
            while (current && !current.classList.contains('vb-row')) {
                if (current.className && typeof current.className === 'string') {
                    const match = current.className.match(/vb-span-(\d+)/);
                    if (match) return parseInt(match[1], 10);
                }
                current = current.parentElement;
                if (!current || current.tagName === 'FORM') break;
            }
            return 12; // Default full width
        },

        _render: function (items) {
            const root = this.brick.dom.element();
            if (!root) return;

            // Always clear existing content when rendering from items list
            root.innerHTML = '';

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type !== 'group') continue;

                const groupEl = document.createElement('div');
                groupEl.className = 'vb-form-group';

                const rowEl = document.createElement('div');
                rowEl.className = 'vb-row';

                if (item.items && item.items.length) {
                    for (let j = 0; j < item.items.length; j++) {
                        const field = item.items[j];
                        const span = field.span || 12;
                        const colEl = document.createElement('div');
                        colEl.className = 'vb-span-' + span;

                        const fieldContainer = document.createElement('div');
                        fieldContainer.className = 'vb-form-field';

                        if (field.label) {
                            const label = document.createElement('label');
                            label.textContent = field.label;
                            if (field.name) label.htmlFor = field.name;
                            fieldContainer.appendChild(label);
                        }

                        let input;
                        if (field.controlType === 'textarea') {
                            input = document.createElement('textarea');
                        } else if (field.controlType === 'select') {
                            input = document.createElement('select');
                            // TODO: options
                        } else {
                            input = document.createElement('input');
                            input.type = field.inputType || 'text';
                        }

                        if (field.name) {
                            input.name = field.name;
                            input.id = field.name;
                        }
                        if (field.placeholder) input.placeholder = field.placeholder;
                        // handle required gracefully
                        if (field.required === true || field.required === 'true' || field.required === 'required') {
                            input.required = true;
                        }

                        fieldContainer.appendChild(input);
                        colEl.appendChild(fieldContainer);
                        rowEl.appendChild(colEl);
                    }
                }

                groupEl.appendChild(rowEl);
                root.appendChild(groupEl);
            }

            // Add Actions container if needed (can be separate config)
        }
    },

    events: [
        {
            for: 'brick:status:ready',
            before: {
                fn: function (ev) {
                    // Start fresh
                    let items = [];
                    // Check options first (programmatic)
                    if (this.brick.options.has('form.items')) {
                        items = this.brick.options.get('form.items');
                    }

                    if (!items || items.length === 0) {
                        // Try to parse from global variable defined in attribute
                        const root = this.brick.dom.element();
                        if (root) {
                            const configVar = root.getAttribute('brick-form-items') || root.getAttribute('data-form-items');
                            if (configVar && window[configVar]) {
                                console.log('[Form Items] Config var found', configVar);
                                items = window[configVar];
                                this.brick.options.set('form.items', items);
                            }
                        }

                        // if still no items, check if current DOM has any specific structure to parse
                        // (only if we didn't just load them from var)
                        if (!items || items.length === 0) {
                            // Try to parse from DOM
                            console.log('[Form Items] Parsing from DOM', this.brick.id);
                            items = this._parseFromDom();
                            this.brick.options.set('form.items', items);
                        }
                    } else {
                        console.log('[Form Items] Config found in options', items);
                    }

                    // Helper to access data in on phase
                    ev.data = ev.data || {};
                    ev.data.formItems = items;
                }
            },
            on: {
                fn: function (ev) {
                    const items = ev.data.formItems || this.brick.options.get('form.items');

                    if (items && items.length > 0) {
                        // We render if there are items. 
                        // Note: If we just parsed them from DOM, this will clear and re-render the same structure.
                        // Ideally we check if we need to render.
                        // But per requirements: "Si li pasem un arbre d'items... tant és el que hi hagi en el html/DOM. Ha d'haver-hi aquells. Si cal netejar el DOM i afegir els nous... es fa."

                        // Optimization: if we just parsed it, re-rendering is redundant but safe. 
                        // To avoid infinite loop or weirdness, we could check a flag, but strict rendering ensures state == DOM.
                        this._render(items);
                    }
                }
            }
        }
    ],

    init: function () {
        return true;
    },

    destroy: function () {
    }
};

VanillaBrick.extensions.record = {
    for: [{ host: 'brick', kind: 'form' }],
    requires: ['dom', 'store'],
    ns: 'record',
    options: {},

    brick: {
        // We could expose methods to get/set the current record directly if needed
        getRecord: function () {
            const data = this.store.load();
            return (data && data.length) ? data[0] : null;
        }
    },

    extension: {
        _bind: function (record) {
            const root = this.brick.dom.element();
            if (!root) return;

            // Iterate over all form fields
            const inputs = root.querySelectorAll('input, select, textarea');
            for (let i = 0; i < inputs.length; i++) {
                const input = inputs[i];
                const name = input.name || input.id;
                if (!name) continue;

                // If record has this field, set value
                if (record && Object.prototype.hasOwnProperty.call(record, name)) {
                    input.value = record[name];
                } else {
                    // Optional: clear if not in record? Or leave defaults?
                    // Typically binding means reflecting state. If state is null, clear.
                    // But if record doesn't have the key, maybe leave it?
                    // Let's assume strict binding for now: if record is null, clear.
                    if (!record) input.value = '';
                }
            }
        }
    },

    events: [
        {
            for: 'brick:status:ready',
            on: {
                fn: function (ev) {
                    const data = this.brick.store.load();
                    if (data && data.length) {
                        this._bind(data[0]);
                    }
                }
            }
        },
        {
            for: 'store:data:*',
            after: {
                fn: function (ev) {
                    const data = this.brick.store.load();
                    // We bind the first record
                    const record = (data && data.length) ? data[0] : null;
                    this._bind(record);
                }
            }
        }
    ],

    init: function () {
        return true;
    },

    destroy: function () {
    }
};

VanillaBrick.extensions.form = {
    for: [{ host: 'brick', kind: 'form' }],
    requires: ['dom'],
    ns: 'form',
    options: {
        items:[],
    },

    brick: {
        // Basic form component methods can be added here
        submit: function () {
            // Placeholder for submit logic
            const el = this.dom.element();
            if (el && typeof el.submit === 'function') el.submit();
        },
        reset: function () {
            const el = this.dom.element();
            if (el && typeof el.reset === 'function') el.reset();
        }
    },

    extension: {
        // Internal extension logic
    },

    events: [
        // Basic lifecycle events
        {
            for: 'brick:status:ready',
            on: {
                fn: function () {
                    // Initialization logic
                }
            }
        }
    ],

    init: function () {
        return true;
    },

    destroy: function () {
    }
};

VanillaBrick.extensions.columns = {
  for: [{ host: 'brick', kind: 'grid' }],
  requires: ['dom', 'store'],
  ns: 'columns',
  options: {},

  brick: {
    get: function () {
      return this.options.get("grid.columns", []);
    },
    sort: function (field, dir) {
      const cols = this.columns.get();
      const colDef = cols.find(function (c) { return c && c.datafield === field; }) || {};
      const state = this.options.get("grid.sort", { field: null, dir: null });
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
          const root = this.brick.dom.element && this.brick.dom.element();
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
          this.brick.options.setSilent("grid.sort", { field: ev.field, dir: ev.dir || 'asc' });
        }
      }
    }
  ],

  init: function () { },

  destroy: function () { },

  options: {
    grid: {
      columns: [
        { datafield: 'code', label: 'Code', sortable: true },
        { datafield: 'name', label: 'Name', sortable: true },
      ]
    }
  }
};


VanillaBrick.extensions.rowsFocused = {
  for: [{ host: 'brick', kind: 'grid' }],
    requires: ['dom', 'rows', 'store'],
    ns: 'rowsFocused',
    options: {},

    brick: {},

    extension: {
        _addTabIndex: function () {
            const el = this.brick.dom.element();
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
            const el = this.brick.dom.element();
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
        }
    },

    events: [
        {
            for: 'brick:status:ready',
            on: {
                fn: function () {
                    const el = this.brick.dom.element();
                    if (el) {
                        const self = this;
                        el.addEventListener('focusin', function (e) {
                            self._handleFocus(e.target);
                        });
                    }
                    this._addTabIndex();
                }
            }
        },
        {
            for: 'store:data:set',
            after: {
                fn: function () {
                    this._addTabIndex();
                }
            }
        },
        {
            for: 'store:data:sort',
            after: {
                fn: function () {
                    this._addTabIndex();
                }
            }
        }
    ],

    init: function () { },

    destroy: function () { }
};

VanillaBrick.extensions.rows = {
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

VanillaBrick.extensions.grid = {
  for: [{ host: 'brick', kind: 'grid' }],
  requires: ['dom'],
  ns: 'grid',
  options: {},

  brick: {
    refresh: function () {
      if (this.__gridExt) this.__gridExt._refreshRows();
    },
    getSelection: function () {
      const ext = this.__gridExt;
      if (!ext) return { index: -1, row: null };
      const idx = (typeof ext.selectedIndex === 'number') ? ext.selectedIndex : -1;
      const row = (idx >= 0 && ext.rows && ext.rows[idx]) ? ext.rows[idx] : null;
      return { index: idx, row: row };
    },
    clearSelection: function () {
      if (this.__gridExt) this.__gridExt._setSelectedIndex(-1);
    }
  },

  extension: {
    table: null,
    rows: [],
    selectedIndex: -1,
    _findTable: function () {
      const root = this.brick.dom && typeof this.brick.dom.element === 'function'
        ? this.brick.dom.element()
        : null;
      if (!root || !root.querySelector) {
        this.table = null;
        return null;
      }
      const table =
        root.querySelector('table.vb-grid') ||
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
        if (i === index) row.classList.add('vb-grid-row-selected');
        else row.classList.remove('vb-grid-row-selected');
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
    this.brick.__gridExt = this;
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
      delete this.brick.__gridExt;
    }
  }
};





/**
 * Per-brick event bus controller.
 * Manages events shaped as "namespace:event:target" with phases before/on/after.
 * @constructor
 */
function EventBusController(brick) {
  this.brick = brick || null;
  this.handlers = []; // { pattern, compiled, phase, priority, handler }
  this._dispatchCache = {};
  this.phases = ['before', 'on', 'after'];

  // Expose public EventBus API on the brick
  var bus = this;
  if (brick) {
    brick.events = {
      on: function (pattern, phase, priority, handler, meta) {
        bus.on(pattern, phase, priority, handler, meta);
        return brick; // permet chaining
      },
      off: function (pattern, phase, handler) {
        bus.off(pattern, phase, handler);
        return brick;
      },
      fire: function (eventName, payload) {
        bus.fire(eventName, payload);
        return brick;
      },
      fireAsync: function (eventName, payload) {
        return bus.fireAsync(eventName, payload);
      }
    };
  }
}

// ---------- Internal utils ----------

EventBusController.prototype._normalizePriority = function (priority) {
  let pr = typeof priority === 'number' ? priority : 5;
  if (pr < 0) pr = 0;
  if (pr > 10) pr = 10;
  return pr;
};

/**
 * Compiles a subscription pattern.
 * Pattern format: "namespace:type:target"
 * Supports '*' as wildcard in any position.
 */
EventBusController.prototype._compilePattern = function (pattern) {
  const parts = (pattern || '').split(':');
  const ns = parts[0];
  const type = parts[1];
  const target = parts[2];

  return {
    namespace: !ns || ns === '*' ? undefined : ns,
    type: !type || type === '*' ? undefined : type,
    target: !target || target === '*' ? undefined : target,
  };
};

/**
 * Parses an event name into its components.
 * Format: "namespace:type:target"
 */
EventBusController.prototype._parseEventKey = function (eventName) {
  const parts = (eventName || '').split(':');
  return {
    namespace: parts[0] || '',
    type: parts[1] || '',
    target: parts[2] || '',
  };
};

EventBusController.prototype._matches = function (compiled, key) {
  return (
    (compiled.namespace === undefined || compiled.namespace === key.namespace) &&
    (compiled.type === undefined || compiled.type === key.type) &&
    (compiled.target === undefined || compiled.target === key.target)
  );
};

EventBusController.prototype._validateEventName = function (eventName) {
  if (typeof eventName !== 'string') {
    console.error('[EventBus] Event name must be a string.', eventName);
    return false;
  }
  const parts = eventName.split(':');

  // Strict 3-segment rule
  if (parts.length !== 3) {
    console.error('[EventBus] Invalid event name format. Expected exactly "namespace:type:target" (3 segments). Got:', eventName);
    return false;
  }

  // Validation for Dispatch: No empty parts, no wildcards allowed
  if (!parts[0] || parts[0] === '*' || !parts[1] || parts[1] === '*' || !parts[2] || parts[2] === '*') {
    console.error('[EventBus] Invalid event name for dispatch. Wildcards (*) and empty segments are not allowed in namespace, type, or target.', eventName);
    return false;
  }

  return true;
};

/**
 * Returns matched handlers grouped by phase for a specific event name.
 * Uses caching. The cache key is the full eventName string.
 */
EventBusController.prototype._getHandlersForEvent = function (eventName) {
  if (this._dispatchCache[eventName]) {
    return this._dispatchCache[eventName];
  }

  const key = this._parseEventKey(eventName);
  const result = {
    before: [],
    on: [],
    after: []
  };

  // this.handlers is expected to be sorted by priority globally
  for (let i = 0; i < this.handlers.length; i += 1) {
    const h = this.handlers[i];
    if (this._matches(h.compiled, key)) {
      if (result[h.phase]) {
        result[h.phase].push(h);
      }
    }
  }

  this._dispatchCache[eventName] = result;
  return result;
};

// ---------- Subscription API ----------

/**
 * Register a handler for a pattern and phase.
 * pattern: "namespace:type:target" (supports '*')
 * phase: "before" | "on" | "after" (default "on")
 * priority: 0..10 (default 5, 0 = highest priority)
 */
EventBusController.prototype.on = function (pattern, phase, priority, handler, meta) {
  // Signature compatibility: on(pattern, phase, priority, handler, meta)
  // Optional args shifting
  if (typeof phase === 'function') {
    meta = handler;
    handler = phase;
    phase = 'on';
    priority = undefined;
  } else if (typeof priority === 'function' && typeof handler !== 'function') {
    meta = handler;
    handler = priority;
    priority = undefined;
  }
  if (typeof handler !== 'function') return;

  let ph = phase || 'on';
  if (this.phases.indexOf(ph) === -1) ph = 'on';

  const pr = this._normalizePriority(priority);

  this.handlers.push({
    pattern: pattern,
    compiled: this._compilePattern(pattern),
    phase: ph,
    handler: handler,
    priority: pr,
    meta: meta || null
  });

  // Sort by priority asc (0 = first)
  this.handlers.sort(function (a, b) {
    const pa = typeof a.priority === 'number' ? a.priority : 5;
    const pb = typeof b.priority === 'number' ? b.priority : 5;
    return pa - pb;
  });

  // Invalidate cache on any subscription change
  this._dispatchCache = {};
};

/**
 * Unregister handlers filtered by pattern, phase and/or handler.
 */
EventBusController.prototype.off = function (pattern, phase, handler) {
  for (let i = this.handlers.length - 1; i >= 0; i -= 1) {
    const h = this.handlers[i];
    if (pattern && h.pattern !== pattern) continue;
    if (phase && h.phase !== phase) continue;
    if (handler && h.handler !== handler) continue;
    this.handlers.splice(i, 1);
  }
  // Invalidate cache on any unsubscription
  this._dispatchCache = {};
};

// ---------- Pipeline execution (async core) ----------

EventBusController.prototype._run = async function (eventName, payload) {
  // 1. Validation
  if (!this._validateEventName(eventName)) {
    // Return a dummy error object so awaits don't crash, but do not process
    return {
      event: { name: eventName },
      errors: [{ error: 'Invalid event name format or wildcards in dispatch' }],
      cancel: true
    };
  }

  // 2. Cache Lookup
  const phases = this.phases;
  const handlersByPhase = this._getHandlersForEvent(eventName);

  // We parse again just to populate the event meta object accurately
  const key = this._parseEventKey(eventName);

  // 3. Event Object Construction
  const ev = {
    brick: this.brick || null,
    cancel: false, // if true, skip "on" phase
    data: payload,
    errors: [], // collected handler errors
    event: {
      phase: null, // "before" | "on" | "after"
      name: eventName,
      namespace: key.namespace,
      type: key.type,   // Renamed from 'event' to 'type'
      target: key.target,
    },
    stopPhase: false, // if true, stop the current phase loop
  };

  // 4. Execution Loop
  for (let p = 0; p < phases.length; p += 1) {
    const phase = phases[p];

    // If canceled, skip "on" phase, but continue to "after"
    if (phase === 'on' && ev.cancel) continue;

    ev.event.phase = phase;
    const phaseHandlers = handlersByPhase[phase] || [];

    for (let i = 0; i < phaseHandlers.length; i += 1) {
      if (ev.stopPhase) break;

      const h = phaseHandlers[i];

      try {
        // Pass event and context
        const r = h.handler(ev, { brick: this.brick });
        if (r && typeof r.then === 'function') {
          await r; // support async handlers
        }
      } catch (err) {
        console.error('Error in handler', h.handler, { pattern: h.pattern, phase: h.phase, meta: h.meta }, err);
        ev.errors.push({ error: err, meta: h.meta, pattern: h.pattern, phase: h.phase });
        // Force cancel on error to prevent inconsistent state
        ev.cancel = true;
      }
    }
  }

  return ev;
};

// ---------- Public API ----------

/**
 * Fire-and-forget event.
 * eventName: "namespace:type:target"
 */
EventBusController.prototype.fire = function (eventName, payload) {
  // Fire-and-forget; use fireAsync() if you need the final event object.
  this._run(eventName, payload);
};

/**
 * Fire an event and get a Promise with the final event object
 * (to inspect cancel/errors/meta).
 */
EventBusController.prototype.fireAsync = function (eventName, payload) {
  return this._run(eventName, payload);
};

// ---------- Hook to global namespace ----------

VanillaBrick.controllers = VanillaBrick.controllers || {};
VanillaBrick.controllers.events = EventBusController;




function parseForPattern(pattern) {
  if (!pattern) return { ns: '', action: '', target: '*' };
  const bits = String(pattern).split(':');
  const ns = bits[0] || '';
  const action = bits[1] || '';
  let target = bits.length > 2 ? bits.slice(2).join(':') : '*';
  if (!target) target = '*';
  return { ns: ns, action: action, target: target };
}

function ExtensionsController(brick) {
  this.brick = brick;
  this.extensions = {};
  this._destroyHook = false;
}

function isArrowFunction(fn) {
  if (typeof fn !== 'function') return false;
  // Arrow functions have no prototype and typically stringify with "=>"
  if (fn.prototype) return false;
  try {
    return fn.toString().indexOf('=>') !== -1;
  } catch (e) {
    return false;
  }
}

ExtensionsController.prototype.applyAll = function () {
  const registry = VanillaBrick.controllers.extensionsRegistry;
  if (!registry || typeof registry.all !== 'function') return;

  // Now registry returns a filtered, sorted, valid list
  const defs = registry.all(this.brick) || [];

  if (defs.length == 0) {
    console.warn("No extensions found for this brick", this.brick);
    return;
  }

  // Phase 1: merge options before any init()
  const optionsCtrl = this.brick._controllers && this.brick._controllers.options;
  const utils = VanillaBrick.utils || {};
  const mergeOptions = utils.mergeOptions;
  if (!mergeOptions || typeof mergeOptions !== 'function') {
    console.error('VanillaBrick.utils.mergeOptions is missing; cannot merge extension defaults safely');
  } else if (optionsCtrl && typeof optionsCtrl.all === 'function') {
    const userOptions = optionsCtrl.all();
    const kind = (this.brick.kind || '').toLowerCase();
    const coreDefaults = [];
    const extDefaults = [];

    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i];
      const defOpts = def.ext.options || def.ext._options;
      if (!defOpts) continue;
      const defName = (def.ext.ns || def.name || '').toLowerCase();
      if (defName && kind && defName === kind + '-core') {
        coreDefaults.push(defOpts);
      } else {
        extDefaults.push(defOpts);
      }
    }

    const mergedOptions = mergeOptions.apply(null, coreDefaults.concat(extDefaults, [userOptions]));
    optionsCtrl.data = mergedOptions;
    optionsCtrl._cache = {};
  }

  // Phase 2: install + init extensions
  for (let i = 0; i < defs.length; i += 1) {
    this._install(defs[i]);
  }

  this._ensureDestroyHook();
};

ExtensionsController.prototype._install = function (def) {
  const brick = this.brick;
  const name = def.name || def.ext.ns || null;
  const ns = def.ext.ns || name;

  if (!name) {
    console.warn('VanillaBrick extension without name/ns, skipped', def);
    return;
  }

  if (this.extensions[name]) return;

  const ext = {
    name: name,
    def: def.ext,
    brick: brick,
  };
  // Contexts with prototype chaining to preserve access to brick/extension state
  const ctxExt = Object.create(ext);
  ctxExt.brick = brick;
  ctxExt.ext = ext;
  const ctxApi = Object.create(brick);
  ctxApi.brick = brick;
  ctxApi.ext = ext;

  // attach internal extension methods to ext (bound + wrapped)
  const runtime = brick._controllers.runtime;
  if (def.ext.extension && typeof def.ext.extension === 'object') {
    for (const k in def.ext.extension) {
      if (!Object.prototype.hasOwnProperty.call(def.ext.extension, k)) continue;
      const fn = def.ext.extension[k];
      if (typeof fn === 'function') {
        if (isArrowFunction(fn)) {
          console.warn('VanillaBrick: arrow functions discouraged for extension private method', { ns: name, fn: k, kind: brick.kind });
        }
        const meta = { type: 'extension-private', ext: name, brick: brick.id, fnName: k };
        ext[k] = function () {
          const args = Array.prototype.slice.call(arguments);
          if (runtime && typeof runtime.execute === 'function') {
            return runtime.execute(fn, ctxExt, args, meta);
          }
          return fn.apply(ctxExt, args);
        };
      }
    }
  }

  // init hook (this === ext, wrapped)
  if (typeof def.ext.init === 'function') {
    const runtime = brick._controllers.runtime;
    try {
      let res;
      if (runtime && typeof runtime.execute === 'function') {
        res = runtime.execute(def.ext.init, ext, [], {
          type: 'init',
          ext: name,
          brick: brick.id,
          fnName: 'init'
        });
      } else {
        res = def.ext.init.call(ext);
      }
      if (res === false) return;
    } catch (err) {
      console.error('VanillaBrick extension "' + name + '" init() failed', err);
      return;
    }
  }

  // expose API on brick namespace (wrapped) only after successful init
  if (def.ext.brick && typeof def.ext.brick === 'object') {
    if (!brick[ns]) brick[ns] = {};
    const nsObj = brick[ns];
    for (const apiName in def.ext.brick) {
      if (!Object.prototype.hasOwnProperty.call(def.ext.brick, apiName)) continue;
      const apiFn = def.ext.brick[apiName];
      if (typeof apiFn !== 'function') {
        console.warn('VanillaBrick extension "' + name + '" api "' + apiName + '" is not a function');
        continue;
      }
      if (isArrowFunction(apiFn)) {
        console.warn('VanillaBrick: arrow functions discouraged for brick API', { ns: name, api: apiName, kind: brick.kind });
      }
      if (nsObj[apiName]) {
        console.warn('VanillaBrick extension overwriting API ' + ns + '.' + apiName);
      }
      const meta = { type: 'brick-api', ext: name, brick: brick.id, fnName: ns + '.' + apiName };
      nsObj[apiName] = function () {
        const args = Array.prototype.slice.call(arguments);
        if (runtime && typeof runtime.execute === 'function') {
          return runtime.execute(apiFn, ctxApi, args, meta);
        }
        return apiFn.apply(ctxApi, args);
      };
    }
  }

  // register event listeners
  if (Array.isArray(def.ext.events) &&
    def.ext.events.length &&
    brick._controllers &&
    brick._controllers.events &&
    typeof brick._controllers.events.on === 'function') {

    for (let li = 0; li < def.ext.events.length; li += 1) {
      const evt = def.ext.events[li];
      if (!evt) continue;
      const parsed = parseForPattern(evt.for);
      const pattern = parsed.ns + ':' + parsed.action + ':' + parsed.target;

      ['before', 'on', 'after'].forEach(function (phase) {
        const desc = evt[phase];
        if (!desc || typeof desc.fn !== 'function') return;
        if (isArrowFunction(desc.fn)) {
          console.warn('VanillaBrick: arrow functions discouraged for event handler', { ns: name, event: pattern, phase: phase, kind: brick.kind });
        }
        const pr = (typeof desc.priority === 'number') ? desc.priority : undefined;
        const pattern = parsed.ns + ':' + parsed.action + ':' + parsed.target;
        const meta = {
          type: 'event',
          ext: name,
          brick: brick.id,
          event: pattern,
          phase: phase,
          fnName: desc.fn.name || 'anon'
        };
        const handler = function (ev) {
          const args = [ev];
          if (runtime && typeof runtime.execute === 'function') {
            return runtime.execute(desc.fn, ctxExt, args, meta);
          }
          return desc.fn.apply(ctxExt, args);
        };
        brick._controllers.events.on(pattern, phase, pr, handler, { ext: name, fn: desc.fn.name || 'anon', extInstance: ext });
      });
    }
  }

  this.extensions[name] = ext;
};

ExtensionsController.prototype._ensureDestroyHook = function () {
  if (this._destroyHook) return;

  const brick = this.brick;
  if (!brick ||
    !brick._controllers ||
    !brick._controllers.events ||
    typeof brick._controllers.events.on !== 'function') {
    return;
  }

  this._destroyHook = true;
  const self = this;

  brick._controllers.events.on(
    'brick:status:destroyed',
    'on',
    0,
    function () {
      for (const name in self.extensions) {
        if (!Object.prototype.hasOwnProperty.call(self.extensions, name)) continue;
        const ext = self.extensions[name];
        if (!ext || !ext.def) continue;
        const def = ext.def;

        if (typeof def.destroy === 'function') {
          const runtime = brick._controllers.runtime;
          try {
            if (runtime && typeof runtime.execute === 'function') {
              runtime.execute(def.destroy, ext, [], {
                type: 'destroy',
                ext: name,
                brick: brick.id,
                fnName: 'destroy'
              });
            } else {
              def.destroy.call(ext);
            }
          } catch (err) {
            console.error('VanillaBrick extension "' + (def.ns || name || '?') + '" destroy() failed', err);
          }
        }
      }

      self.extensions = {};
    }
  );
};

VanillaBrick.controllers.extensions = ExtensionsController;

// Diccionari de definicions d'extensions:
//   VanillaBrick.extensions.myExt = { ns: "myExt", ... }
VanillaBrick.extensions = VanillaBrick.extensions || {};

// Petit helper de registre/base
// (ara mateix només serveix per obtenir totes les definicions)
VanillaBrick.controllers.extensionsRegistry = VanillaBrick.controllers.extensionsRegistry || {
  /**
   * Retorna un array amb totes les definicions d'extensions
   * definides a VanillaBrick.extensions.*
   */
  _cache: {},

  /**
   * Retorna un array amb totes les definicions d'extensions
   * filtrades per host/kind i amb dependències resoltes (topological sort).
   *
   * @param {Object} brick - Instancia del brick o objecte de metadates {host:'brick', kind:'grid'}
   */
  all: function (brick) {
    if (!brick || typeof brick !== 'object') {
      console.warn('ExtensionsRegistry.all() called without brick context');
      return [];
    }

    const host = (brick.host || 'brick').toLowerCase();
    const kind = brick.kind;
    if (!kind) return [];

    const cacheKey = host + '::' + kind;
    if (this._cache[cacheKey]) {
      return this._cache[cacheKey];
    }

    const src = VanillaBrick.extensions || {};
    const candidates = {};

    function normalizeRule(rule) {
      if (!rule || typeof rule !== 'object') return null;
      const rHost = (rule.host || 'brick').toLowerCase();
      const rKind = typeof rule.kind === 'string' ? rule.kind.toLowerCase() : '';
      if (!rKind) return null;
      return { host: rHost, kind: rKind };
    }

    function matchesRule(rule, currentHost, currentKind) {
      if (!rule) return false;
      const hostMatch = rule.host === '*' || rule.host === currentHost;
      const kindMatch = rule.kind === '*' || rule.kind === currentKind;
      return hostMatch && kindMatch;
    }

    // 1. Initial Filter by host/kind (and prepare candidates map)
    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      const def = src[key];
      if (!def || typeof def !== 'object') continue;

      // Normalitzar el nom intern
      if (!def._name) def._name = def.ns || key;

      const rules = def.for;
      if (!Array.isArray(rules) || !rules.length) {
        console.warn('VanillaBrick extension without valid `for` array, skipped', def._name || key);
        continue;
      }

      let match = false;
      for (let ri = 0; ri < rules.length; ri += 1) {
        const rule = normalizeRule(rules[ri]);
        if (!rule) continue;
        if (matchesRule(rule, host, kind)) {
          match = true;
          break;
        }
      }

      if (match) {
        candidates[key] = { name: key, ext: def };
      }
    }

    // 2. Recursive Validation & Topological Sort (DFS)
    const sortedList = [];
    // Status: undefined (unvisited), 'visiting', 'ok', 'missing'
    const status = {};

    function visit(name) {
      if (status[name] === 'ok') return true;
      if (status[name] === 'visiting') return false; // Cycle detection
      if (status[name] === 'missing') return false;

      const candidate = candidates[name];
      if (!candidate) {
        status[name] = 'missing';
        return false;
      }

      status[name] = 'visiting';

      const reqs = candidate.ext.requires || candidate.ext._requires;
      if (Array.isArray(reqs)) {
        for (let i = 0; i < reqs.length; i++) {
          const depName = reqs[i];
          if (!visit(depName)) {
            status[name] = 'missing'; // Dependency failed
            return false;
          }
        }
      }

      status[name] = 'ok';
      sortedList.push(candidate);
      return true;
    }

    for (const name in candidates) {
      visit(name);
    }

    this._cache[cacheKey] = sortedList;
    return sortedList;
  }
};



/**
 * Per-brick options controller.
 * Guarda valors en objectes nested segons rutes amb punts,
 * mantenint compatibilitat de lectura amb claus planes.
 * @constructor
 * @param {Object} brick
 * @param {Object} initial
 */
function OptionsController(brick, initial) {
  this.brick = brick;
  this.data = {};
  this._cache = {}; // Cache for O(1) reads
  this._eventsBound = false;

  if (initial && typeof initial === 'object') {
    for (const k in initial) {
      if (Object.prototype.hasOwnProperty.call(initial, k)) {
        setPath(this.data, toPath(k), initial[k]);
      }
    }
  }

  var ctrl = this;

  // API pública al brick
  brick.options = {
    get: function (key, fallback) {
      return ctrl.get(key, fallback);
    },

    // Síncron: dispara events via fire()
    set: function (key, value) {
      ctrl.setSync(key, value);
      return brick;
    },

    // Async: dispara events via fireAsync()
    setAsync: async function (key, value) {
      await ctrl.setAsync(key, value);
      return brick; // permet await brick.options.setAsync(...); i chaining
    },

    has: function (key) {
      return ctrl.has(key);
    },

    all: function () {
      return ctrl.all();
    },

    setSilent: function (key, value) {
      ctrl.setSilent(key, value);
      return brick; // chaining
    }
  };
}

/**
 * Registra el handler _apply al bus d'events
 * per a la fase "on" de "options:value:*".
 * Només es fa un cop.
 */
OptionsController.prototype._ensureEventsBinding = function () {
  if (this._eventsBound) return;

  var brick = this.brick;
  var self = this;

  // Confies en la arquitectura: brick.events i on() EXISTEIXEN.
  brick.events.on('options:value:*', 'on', 5, function (ev) {
    self._apply(ev);
  });

  this._eventsBound = true;
};

/**
 * Handler de fase "on" per "options:value:*".
 * Aplica els canvis a this.data a partir de ev.data.
 *
 * Shape assumit:
 *  - single: { key, value, previous, options, brick }
 *  - batch:  { batch:true, values:{...}, previous:{...}, options, brick }
 *
 * @param {Object} ev - event del EventBus
 */
OptionsController.prototype._apply = function (ev) {
  if (!ev) return;
  var payload = ev.data || {};

  // Invalidate cache on any update
  this._cache = {};

  // Batch: set({ a:1, b:2 }) / set({ dom:{id:'x'} })
  if (payload.batch && payload.values && typeof payload.values === 'object') {
    for (var k in payload.values) {
      if (Object.prototype.hasOwnProperty.call(payload.values, k)) {
        setPath(this.data, toPath(k), payload.values[k]);
      }
    }
    return;
  }

  // Single: set('foo', 123)
  if (typeof payload.key === 'string') {
    setPath(this.data, toPath(payload.key), payload.value);
  }
};

/**
 * Set a value or merge an object, disparant events options:value.
 * Sempre usa fireAsync per permetre handlers async.
 *
 * @param {string|Object} key
 * @param {any} value
 * @returns {Promise<OptionsController>}
 */
OptionsController.prototype.setAsync = async function (key, value) {
  this._ensureEventsBinding();

  var brick = this.brick;

  // OBJECTE: set({ a:1, b:2 }) (pot incloure nested)
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    var values = {};
    var previous = {};

    flattenEntries(key, '', values);

    for (var vk in values) {
      if (!Object.prototype.hasOwnProperty.call(values, vk)) continue;
      previous[vk] = getWithFallback(this.data, vk);
    }

    var batchPayload = {
      batch: true,
      values: values,
      previous: previous,
      options: this,
      brick: brick
    };

    // sense target: "options:value:"
    // target "batch" per evitar el validator de 3 segments
    await brick.events.fireAsync('options:value:batch', batchPayload);
    return this;
  }

  // SINGLE: set('theme', 'dark')
  var oldValue = getWithFallback(this.data, key);

  var payload = {
    key: key,
    value: value,
    previous: oldValue,
      options: this,
      brick: brick
    };

    // amb target: "options:value:<key>"
    await brick.events.fireAsync('options:value:' + key, payload);
    return this;
};

/**
 * Set a value or merge an object, disparant events options:value de forma síncrona.
 * @param {string|Object} key
 * @param {any} value
 * @returns {OptionsController}
 */
OptionsController.prototype.setSync = function (key, value) {
  this._ensureEventsBinding();

  var brick = this.brick;

  // OBJECTE: set({ a:1, b:2 }) (pot incloure nested)
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    var values = {};
    var previous = {};

    flattenEntries(key, '', values);

    for (var vk in values) {
      if (!Object.prototype.hasOwnProperty.call(values, vk)) continue;
      previous[vk] = getWithFallback(this.data, vk);
    }

    var batchPayload = {
      batch: true,
      values: values,
      previous: previous,
      options: this,
      brick: brick
    };

    // sense target: "options:value:"
    // target "batch" per evitar el validator de 3 segments
    brick.events.fire('options:value:batch', batchPayload);
    return this;
  }

  // SINGLE: set('theme', 'dark')
  var oldValue = getWithFallback(this.data, key);

  var payload = {
    key: key,
    value: value,
    previous: oldValue,
    options: this,
    brick: brick
  };

  // amb target: "options:value:<key>"
  brick.events.fire('options:value:' + key, payload);
  return this;
};

// Compat: alias set -> setAsync
OptionsController.prototype.set = OptionsController.prototype.setAsync;

/**
 * Set sense emetre events.
 * @param {string|Object} key
 * @param {any} value
 * @returns {OptionsController}
 */
OptionsController.prototype.setSilent = function (key, value) {
  // Invalidate cache
  this._cache = {};

  // OBJECTE: setSilent({ a:1, b:2 })
  if (key && typeof key === 'object' && !Array.isArray(key)) {
    flattenEntries(key, '', this.data);
    return this;
  }

  // SINGLE: setSilent('foo', 123)
  setPath(this.data, toPath(key), value);
  return this;
};

/**
 * Get a value by key or return fallback.
 * @param {string} key
 * @param {any} fallback
 * @returns {any}
 */
OptionsController.prototype.get = function (key, fallback) {
  // 1. Return from cache if available
  if (Object.prototype.hasOwnProperty.call(this._cache, key)) {
    return this._cache[key];
  }

  // 2. Slow lookup
  var val = getWithFallback(this.data, key);
  var result = typeof val === 'undefined' ? fallback : val;

  // 3. Store in cache
  this._cache[key] = result;

  return result;
};

/**
 * Indica si la clau existeix.
 * @param {string} key
 * @returns {boolean}
 */
OptionsController.prototype.has = function (key) {
  var path = toPath(key);
  if (!path.length) return false;
  var nested = hasPath(this.data, path);
  if (nested) return true;
  // compatibilitat: clau plana
  return Object.prototype.hasOwnProperty.call(this.data, key);
};

/**
 * Retorna una còpia superficial de totes les opcions.
 * @returns {Object}
 */
OptionsController.prototype.all = function () {
  return Object.assign({}, this.data);
};

// Helpers per gestionar claus amb punts com a rutes nested
function toPath(key) {
  if (!key && key !== 0) return [];
  if (Array.isArray(key)) return key;
  return String(key)
    .split('.')
    .filter(function (p) { return p !== ''; });
}

function setPath(obj, path, value) {
  if (!path.length) return;
  var cur = obj;
  for (var i = 0; i < path.length - 1; i += 1) {
    var seg = path[i];
    if (!cur[seg] || typeof cur[seg] !== 'object') {
      cur[seg] = {};
    }
    cur = cur[seg];
  }
  cur[path[path.length - 1]] = value;
}

function getPath(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i += 1) {
    var seg = path[i];
    if (!cur || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return undefined;
    }
    cur = cur[seg];
  }
  return cur;
}

function hasPath(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i += 1) {
    var seg = path[i];
    if (!cur || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return false;
    }
    cur = cur[seg];
  }
  return true;
}

function getWithFallback(data, key) {
  var path = toPath(key);
  if (path.length) {
    var nested = getPath(data, path);
    if (typeof nested !== 'undefined') return nested;
  }
  // compatibilitat amb claus planes existents
  if (Object.prototype.hasOwnProperty.call(data, key)) {
    return data[key];
  }
  return undefined;
}

// Extreu claus de tipus objecte en forma de "a.b": valor
function flattenEntries(src, prefix, target) {
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    var path = prefix ? prefix + '.' + k : k;
    var val = src[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flattenEntries(val, path, target);
    } else {
      target[path] = val;
    }
  }
}

VanillaBrick.controllers = VanillaBrick.controllers || {};
VanillaBrick.controllers.options = OptionsController;

/**
 * Runtime controller - wraps all developer code execution from extensions.
 * Provides centralized error handling and metadata capture for debugging.
 * @constructor
 * @param {Object} brick - The brick instance this controller belongs to
 */
function RuntimeController(brick) {
    this.brick = brick || null;
}

/**
 * Execute developer code with error handling and metadata capture.
 * 
 * @param {Function} fn - The function to execute
 * @param {Object} context - The 'this' context for the function
 * @param {Array} args - Arguments to pass to the function
 * @param {Object} meta - Metadata for debugging
 *   - type: 'event' | 'init' | 'destroy' | 'brick-api' | 'extension-private'
 *   - ext: extension name
 *   - brick: brick.id (optional)
 *   - event: event name (optional, for event handlers)
 *   - phase: event phase (optional, for event handlers)
 *   - fnName: function name (optional)
 * @returns {*} The result of the function execution
 */
RuntimeController.prototype.execute = function (fn, context, args, meta) {
    "use strict";
    if (typeof fn !== 'function') {
        console.warn('[RuntimeController] Attempted to execute non-function', meta);
        return undefined;
    }

    try {
        const result = fn.apply(context, args);

        // Support async functions
        if (result && typeof result.then === 'function') {
            return result.catch(function (err) {
                this._handleError(err, fn, context, meta);
                return Promise.reject(err);
            }.bind(this));
        }

        return result;
    } catch (err) {
        this._handleError(err, fn, context, meta);
        throw err;
    }
};

/**
 * Handle errors from developer code execution.
 * Logs detailed information including source code for debugging.
 * 
 * @param {Error} err - The error that occurred
 * @param {Function} fn - The function that threw the error
 * @param {Object} context - The context the function was executed in
 * @param {Object} meta - Metadata about the execution
 * @private
 */
RuntimeController.prototype._handleError = function (err, fn, context, meta) {
    var brickCtx = (context && context.brick) ? context.brick : context;
    const errorInfo = {
        error: err,
        message: err.message || String(err),
        stack: err.stack,
        meta: meta || {},
        context: {
            brick: brickCtx && brickCtx.id ? brickCtx.id : null,
            kind: brickCtx && brickCtx.kind ? brickCtx.kind : null
        }
    };

    // Try to capture function source for debugging
    try {
        errorInfo.fnSource = fn.toString();
    } catch (e) {
        errorInfo.fnSource = '[unable to capture source]';
    }

    console.error('[RuntimeController] Error executing developer code:', errorInfo);

    // Future: delegate to errorController
    // if (this.errorController && typeof this.errorController.handle === 'function') {
    //   this.errorController.handle(errorInfo);
    // }
};

/**
 * Wrap a function with runtime execution protection.
 * Returns a new function that will execute through the runtime controller.
 * 
 * @param {Function} fn - The function to wrap
 * @param {Object} context - The 'this' context for the function
 * @param {Object} meta - Metadata for debugging
 * @returns {Function} Wrapped function
 */
RuntimeController.prototype.wrap = function (fn, context, meta) {
    if (typeof fn !== 'function') {
        return fn;
    }

    const runtime = this;
    return function wrappedFunction() {
        const args = Array.prototype.slice.call(arguments);
        return runtime.execute(fn, context, args, meta);
    };
};

// Expose constructor for per-brick instantiation
VanillaBrick.controllers = VanillaBrick.controllers || {};
VanillaBrick.controllers.runtime = RuntimeController;


/**
 * Status Controller
 * Manages the lifecycle state of the brick via EventBus.
 * @constructor
 */
function StatusController(brick) {
    this.brick = brick;
    this._status = 'initializing';
    this._listening = false;

    // Expose public Status API on the brick
    var self = this;
    if (brick) {
        brick.status = {
            get: function () {
                return self.get();
            },
            set: function (newStatus) {
                return self.set(newStatus);
            },
            is: function (status) {
                return self.is(status);
            }
        };
    }
}

StatusController.prototype.get = function () {
    return this._status;
};

StatusController.prototype.set = function (newStatus, payload) {
    // Fallback: if events system is not available yet (very early init), just set it.
    if (!this.brick.events) {
        this._status = newStatus;
        return;
    }

    // Lazy registration: ensure internal state is updated via EventBus 'on' phase
    if (!this._listening) {
        var self = this;
        // Wildcard listener to catch ANY status change event (brick:status:ready, etc.)
        this.brick.events.on('brick:status:*', 'on', function (ev) {
            // Update internal state from payload
            if (ev.data && ev.data.status) {
                self._status = ev.data.status;
            }
        });
        this._listening = true;
    }

    // Prepare event data mixing standard fields with payload
    var eventData = Object.assign({}, payload || {}, {
        status: newStatus,
        from: this._status
    });

    // Fire specific event dynamic name: e.g., "brick:status:ready"
    this.brick.events.fire('brick:status:' + newStatus, eventData);
};

StatusController.prototype.is = function (status) {
    return this._status === status;
};

VanillaBrick.controllers.status = StatusController;

VanillaBrick.extensions.domCss = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['dom'],
  ns: 'css',
  options: {},

  brick: {
    addClass: function (className) {
      const el = this.dom.element();
      if (!el || !className) return;
      if (el.classList && el.classList.add) {
        el.classList.add(className);
      } else {
        const cur = el.className || '';
        if ((' ' + cur + ' ').indexOf(' ' + className + ' ') === -1) {
          el.className = (cur ? cur + ' ' : '') + className;
        }
      }
    },
    removeClass: function (className) {
      const el = this.dom.element();
      if (!el || !className) return;
      if (el.classList && el.classList.remove) {
        el.classList.remove(className);
      } else {
        const cur = el.className || '';
        el.className = (' ' + cur + ' ').replace(' ' + className + ' ', ' ').trim();
      }
    },
    hasClass: function (className) {
      const el = this.dom.element();
      if (!el || !className) return false;
      if (el.classList && el.classList.contains) return el.classList.contains(className);
      const cur = el.className || '';
      return (' ' + cur + ' ').indexOf(' ' + className + ' ') !== -1;
    },
    toggleClass: function (className, force) {
      const el = this.dom.element();
      if (!el || !className) return;
      if (el.classList && typeof el.classList.toggle === 'function') {
        if (typeof force === 'boolean') el.classList.toggle(className, force);
        else el.classList.toggle(className);
      } else {
        const has = this.css.hasClass(className);
        if (typeof force === 'boolean') {
          if (force && !has) this.css.addClass(className);
          if (!force && has) this.css.removeClass(className);
        } else {
          if (has) this.css.removeClass(className);
          else this.css.addClass(className);
        }
      }
    },
    show: function () {
      const el = this.dom.element();
      if (!el) return;
      el.style.display = '';
    },
    hide: function () {
      const el = this.dom.element();
      if (!el) return;
      el.style.display = 'none';
    },
    setStyle: function (prop, value) {
      const el = this.dom.element();
      if (!el || !prop) return;
      el.style[prop] = value;
    },
    getStyle: function (prop) {
      const el = this.dom.element();
      if (!el || !prop || typeof window === 'undefined' || !window.getComputedStyle) return null;
      const cs = window.getComputedStyle(el);
      return cs ? (cs.getPropertyValue(prop) || cs[prop]) : null;
    },
    setVar: function (name, value) {
      const el = this.dom.element();
      if (!el || !name) return;
      if (name.indexOf('--') !== 0) name = '--' + name;
      el.style.setProperty(name, value);
    },
    getVar: function (name) {
      const el = this.dom.element();
      if (!el || !name || typeof window === 'undefined' || !window.getComputedStyle) return null;
      if (name.indexOf('--') !== 0) name = '--' + name;
      const cs = window.getComputedStyle(el);
      return cs ? cs.getPropertyValue(name) : null;
    }
  },

  extension: {},
  events: [],

  init: function () {
    if (!this.brick || !this.brick.dom || typeof this.brick.dom.element !== 'function') {
      console.warn('VanillaBrick domCss requires dom extension active', this.brick && this.brick.id);
      return false;
    }
    const el = this.brick.dom.element();
    if (!el) {
      console.warn('VanillaBrick domCss: no DOM element resolved', this.brick && this.brick.id);
      return false;
    }
    return true;
  },

  destroy: function () {}
};

VanillaBrick.extensions.domEvents = {
  for: [{ host: 'brick', kind: '*' }],
  requires: ['dom'],
  ns: 'dom',
  options: {},

  brick: {},

  extension: {},

  events: [
    {
      for: 'brick:status:ready',
      on: {
        fn: function () {
          const el = this.brick.dom.element();
          if (!el || typeof el.addEventListener !== 'function') return;
          let listeners = this.brick.options.get("dom.events.listeners", []);
          if (!Array.isArray(listeners)) listeners = [];
          const self = this;
          const defaultMap = [
            { type: 'click', eventName: 'dom:mouse:click' },
            { type: 'mouseenter', eventName: 'dom:hover:on' },
            { type: 'mouseleave', eventName: 'dom:hover:off' },
            { type: 'mousedown', eventName: 'dom:mouse:down' },
            { type: 'mouseup', eventName: 'dom:mouse:up' },
          ];

          for (let i = 0; i < defaultMap.length; i += 1) {
            const entry = defaultMap[i];
            const handler = function handler(domEvent) {
              self.brick.events.fire(entry.eventName, {
                domEvent: domEvent,
                element: el,
              });
            };
            el.addEventListener(entry.type, handler);
            listeners.push({ type: entry.type, handler: handler, source: 'default' });
          }
          this.brick.options.setSilent("dom.events.listeners", listeners);
        }
      }
    },
    {
      for: 'brick:status:destroyed',
      before: {
        fn: function () {
          const el = this.brick && this.brick.dom.element && this.brick.dom.element();
          if (!el || typeof el.removeEventListener !== 'function') return;
          const listeners = this.brick.options.get("dom.events.listeners", []);
          if (!Array.isArray(listeners)) return;
          for (let i = 0; i < listeners.length; i += 1) {
            const ln = listeners[i];
            el.removeEventListener(ln.type, ln.handler, ln.options);
          }
          this.brick.options.setSilent("dom.events.listeners", []);
        }
      }
    }
  ],

  init: function () { },
  destroy: function () { }
};

VanillaBrick.extensions.dom = {
  for: [{ host: 'brick', kind: '*' }],
  requires: [],
  ns: 'dom',
  options: {},

  brick: {
    element: function () {
      return this.options.get('dom.element', null);
    },
    on: function (type, handler, options) {
      const el = this.options.get('dom.element', null);
      if (!el || typeof el.addEventListener !== 'function' || typeof handler !== 'function') return;
      el.addEventListener(type, handler, options);
      let listeners = this.options.get('dom.listeners', []);
      if (!Array.isArray(listeners)) listeners = [];
      listeners.push({ type: type, handler: handler, options: options, source: 'api' });
      this.options.setSilent('dom.listeners', listeners);
    },
    off: function (type, handler, options) {
      const el = this.options.get('dom.element', null);
      if (!el || typeof el.removeEventListener !== 'function' || typeof handler !== 'function') return;
      el.removeEventListener(type, handler, options);
      const listeners = this.options.get('dom.listeners', []);
      if (!Array.isArray(listeners)) return;
      for (let i = listeners.length - 1; i >= 0; i -= 1) {
        const ln = listeners[i];
        if (ln.type === type && ln.handler === handler) {
          listeners.splice(i, 1);
        }
      }
      this.options.setSilent('dom.listeners', listeners);
    }
  },

  extension: {
    _resolveElement: function (value) {
      if (!value) return null;
      if (typeof Element !== 'undefined' && value instanceof Element) return value;
      if (value && value.nodeType === 1) return value;
      if (typeof value === 'function') {
        try {
          return value();
        } catch (err) {
          return null;
        }
      }
      return null;
    },
    _resolveById: function (id) {
      if (!id || typeof id !== 'string') return null;
      if (typeof document === 'undefined') return null;
      return document.getElementById(id) || null;
    }
  },

  events: [],

  init: function () {
    if (!this.brick) return false;
    const elemOpt = this.brick.options.get('dom.element', null);
    const idOpt = this.brick.options.get('dom.id', null);

    let el = this._resolveElement(elemOpt);
    if (!el && idOpt) {
      el = this._resolveById(idOpt);
    }

    if (!el) {
      console.warn('VanillaBrick dom extension requires a DOM element (options.dom.element) or a valid options.dom.id', this.brick.id);
      return false;
    }

    if (elemOpt && !this._resolveElement(elemOpt)) {
      console.warn('VanillaBrick dom element must be a DOM node or factory, not an id. Use options.dom.id to resolve by id.', this.brick.id);
    }

    this.brick.options.set('dom.element', el);
    return true;
  },

  destroy: function () {
    const el = this.brick.options.get('dom.element',null);
    const listeners = this.brick.options.get('dom.listeners',null);;
    if (el && Array.isArray(listeners)) {
      for (let i = 0; i < listeners.length; i += 1) {
        const ln = listeners[i];
        if (ln && ln.type && ln.handler) {
          el.removeEventListener(ln.type, ln.handler, ln.options);
        }
      }
    }
  }
};

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

VanillaBrick.extensions.store = {
  for: [
    { host: 'brick', kind: 'form' },
    { host: 'brick', kind: 'grid' }
  ],
  requires: [],
  ns: 'store',
  options: {},

  // API pública sobre el brick (this === brick)
  brick: {
    load: function () {
      return this.options.get('store.data', []);
    },
    set: function (data) {
      if (data === null) return;
      const previous = this.options.get('store.data', []);
      data = Array.isArray(data) ? data.slice() : [data];

      this.events.fire('store:data:set', {
        previous: previous,
        data: data
      });

      return data;
    },
    setAsync: async function (data) {
      const previous = this.options.get('store.data', []);
      data = Array.isArray(data) ? data.slice() : [];

      await this.events.fireAsync('store:data:set', {
        previous: previous,
        data: data
      });

      return data;
    },
    all: function () {
      return this.store.load();
    },
    get: function (index) {
      const arr = this.store.load();
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

VanillaBrick.extensions.wire = {
    for: [{ host: 'brick', kind: '*' }], // Available to all bricks
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {
        send: function (eventName, data) {
            console.warn("send",eventName, data);
            console.log("this",this);
            if (!this.service) this.ext._connect();
            if (!this.service) return; // Still no service?
            console.log("this.service",this.service);
            this.service.events.fire('wire:message', {
                from: this.brick.id,
                event: eventName,
                data: data
            });
        }
    },

    extension: {
        service: null,

        _connect: function () {

            if (this.ext._service) return;

            let wireKind = this.brick.options.get("wire",null);
            if (wireKind == null) return;

            // Connect to WireService
            if (VanillaBrick.service) {
                this.ext._service = VanillaBrick.service('WireService');
            }

            if (this.ext._service) {
                this.ext._service.wire.register(this.brick,this.brick.options.get("wire",{}));
            }
        },

        _handleBroadcast: function (ev) {
            const payload = ev.data || {};
            const senderId = payload.from;
            const eventName = payload.event;
            const data = payload.data;

            // Don't echo back to self?
            if (senderId === this.brick.id) return;

            // Fire local event
            // We wrap it? or just fire raw?
            // User said "proxy per a que... s'enviïn events".
            // If brick A sends "user:login", brick B should receive "user:login".
            if (eventName) {
                this.brick.events.fire(eventName, data);
            }
        },

        _send: function (eventName, data) {
            if (!this.service) this._connect();
            if (!this.service) return; // Still no service?

            this.service.events.fire('wire:message', {
                from: this.brick.id,
                event: eventName,
                data: data
            });
        }
    },

    events: [
        {
            for: 'brick:status:ready',
            on: {
                fn: function () {
                    this._connect();
                }
            }
        },
        {
            for: 'wire:outbound',
            on: {
                fn: function (ev) {
                    const p = ev.data || {};
                    this._send(p.event, p.data);
                }
            }
        },
        {
            for: '*:*:*',
            on: {
                fn: function (ev) {
                    console.log("wire", ev);
                }
            }
        }
    ],

    init: function () { },

    destroy: function () { }
};

VanillaBrick.extensions.wireservice = {
    for: [{ host: 'service', kind: 'wire' }], // Available to all bricks
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {
        register: function (brick,config) {
            console.log("register",brick,config);
        },
        login: function (brick,config) {
            console.log("login",this,brick,config);
        }
    },
    events: [
        {
            for: 'wire:send:register',
            on: {
                fn: function (ev) {
                    console.log("",ev)
                }
            }
        },
    ],
}

VanillaBrick.services.WireService = {
    kind: 'wire',

};


  VanillaBrick.base = VanillaBrick.base || {};
  VanillaBrick.configs = VanillaBrick.configs || {};

  const registry = {
    list: [],
    byId: {},
  };

  function loadConfigs(scope) {
    if (typeof document === 'undefined') return;
    const root = scope || document;
    if (!root.querySelectorAll) return;
    const scripts = root.querySelectorAll('script[type="application/json"][data-brick]');
    for (let i = 0; i < scripts.length; i += 1) {
      const node = scripts[i];
      const raw = node.textContent || '';
      if (!raw.trim()) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;
        for (const key in parsed) {
          if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
          const base = (VanillaBrick.configs[key] && typeof VanillaBrick.configs[key] === 'object')
            ? VanillaBrick.configs[key]
            : {};
          const next = parsed[key];
          if (!next || typeof next !== 'object') continue;
          VanillaBrick.configs[key] = Object.assign({}, base, next);
        }
      } catch (err) {
        console.warn('VanillaBrick: invalid JSON in data-brick config', err);
      }
    }
  }

  function readKind(el) {
    if (!el) return undefined;
    // data-kind o data-brick-kind
    const k =
      el.getAttribute('brick-kind') ||
      el.getAttribute('data-kind') ||
      el.getAttribute('data-brick-kind') ||
      (el.dataset && (el.dataset.kind || el.dataset.brickKind));
    return k ? String(k).toLowerCase() : undefined;
  }

  function createBrickFromElement(el) {
    if (!el) return null;

    // Ja inicialitzat?
    if (el.__brickInstance) return el.__brickInstance;

    const opts = {};

    const config = el.id && VanillaBrick.configs ? VanillaBrick.configs[el.id] : null;
    if (config && typeof config === 'object') {
      Object.assign(opts, config);
    }

    if (el.id) {
      opts.id = el.id;
    }

    const kind = readKind(el);
    if (kind) {
      opts.kind = kind;
    }

    // NESTED: tot el que és de DOM sota dom.{}
    opts.dom = {
      id: el.id || null,
      element: el
    };

    const brick = new VanillaBrick.brick(opts);

    el.__brickInstance = brick;
    registry.list.push(brick);
    registry.byId[brick.id] = brick;
    console.log("Brick",el.id,brick);
    return brick;
  }

  function bootstrap(root) {
    if (typeof document === 'undefined') return [];
    const scope = root || document;
    if (!scope.querySelectorAll) return [];

    // Carrega tots els blocs de configuració abans de crear bricks
    loadConfigs(scope);

    const nodes = scope.querySelectorAll('.vb');
    const created = [];

    for (let i = 0; i < nodes.length; i++) {
      const brick = createBrickFromElement(nodes[i]);
      if (brick) created.push(brick);
    }

    return created;
  }

  VanillaBrick.base.bootstrap = bootstrap;
  VanillaBrick.runtime = VanillaBrick.runtime || {};
  VanillaBrick.runtime.bricks = registry.list || [];
  VanillaBrick.base.getBrick = function (id) {
    return registry.byId[id] || null;
  };

  if (typeof document !== 'undefined') {
    var bootstrapped = false;
    function runOnce() {
      if (bootstrapped) return;
      bootstrapped = true;
      bootstrap();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        runOnce();
      });
    } else {
      // DOM ja llest: posposem al next tick per deixar executar scripts defer restants
      setTimeout(runOnce, 0);
    }
  }


// Ensure runtime services registry
VanillaBrick.runtime.services = VanillaBrick.runtime.services || {};

// Public accessor
VanillaBrick.service = function (name) {
    // Check if running
    if (VanillaBrick.runtime.services[name]) {
        return VanillaBrick.runtime.services[name];
    }
    // Try to start
    return VanillaBrick.base.serviceStart(name);
};

// Internal helpers in base
VanillaBrick.base.serviceStart = function (name) {
    if (VanillaBrick.runtime.services[name]) {
        return VanillaBrick.runtime.services[name];
    }

    const def = VanillaBrick.services[name];
    if (!def) {
        console.warn("Service definition not found:", name);
        return null;
    }

    const opts = Object.assign({}, def);
    opts.id = name; // Service name as ID
    opts.host = 'service';
    opts.kind = opts.kind || 'service';

    // Create brick instance
    const brick = new VanillaBrick.brick(opts);

    // Register instance
    VanillaBrick.runtime.services[name] = brick;

    if (VanillaBrick.runtime.bricks && Array.isArray(VanillaBrick.runtime.bricks)) {
        VanillaBrick.runtime.bricks.push(brick);
    }

    return brick;
};

VanillaBrick.base.serviceStop = function (name) {
    const service = VanillaBrick.runtime.services[name];
    if (!service) return;

    if (service.destroy) service.destroy();

    delete VanillaBrick.runtime.services[name];
};

// Utilities for safe deep cloning and merging of options objects.
// Exposed under VanillaBrick.utils.*

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isPollutionKey(key) {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function assertSafeValue(value, path) {
  if (
    value === null ||
    typeof value === 'undefined' ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return { ok: true };
  }
  if (Array.isArray(value)) return { ok: true };
  if (isPlainObject(value)) return { ok: true };

  const msg = 'VanillaBrick options only support primitives, plain objects, and arrays. Invalid at "' + path + '"';
  console.error(msg, value);
  return { ok: false };
}

function deepCloneOptions(value, path) {
  const currentPath = path || '';
  const valid = assertSafeValue(value, currentPath || '<root>');
  if (!valid.ok) {
    // unsupported value: keep reference
    return value;
  }

  if (Array.isArray(value)) {
    const arr = new Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      arr[i] = deepCloneOptions(value[i], currentPath ? currentPath + '[' + i + ']' : '[' + i + ']');
    }
    return arr;
  }

  if (isPlainObject(value)) {
    const obj = {};
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (isPollutionKey(key)) continue;
      const childPath = currentPath ? currentPath + '.' + key : key;
      obj[key] = deepCloneOptions(value[key], childPath);
    }
    return obj;
  }

  // primitive
  return value;
}

function deepMergeOptions(dest) {
  if (!isPlainObject(dest)) {
    dest = {};
  }

  for (let si = 1; si < arguments.length; si += 1) {
    const src = arguments[si];
    if (src === null || typeof src === 'undefined') continue;
    if (!isPlainObject(src)) {
      const path = '<root>';
      return deepCloneOptions(src, path);
    }

    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      if (isPollutionKey(key)) continue;
      const val = src[key];
      const path = key;

      if (Array.isArray(val)) {
        dest[key] = deepCloneOptions(val, path);
        continue;
      }

      if (isPlainObject(val)) {
        if (!isPlainObject(dest[key])) {
          dest[key] = {};
        }
        deepMergeOptions(dest[key], val);
        continue;
      }

      const valid = assertSafeValue(val, path);
      dest[key] = val;
    }
  }

  return dest;
}

function mergeOptions() {
  const args = Array.prototype.slice.call(arguments);
  args.unshift({});
  return deepMergeOptions.apply(null, args);
}

VanillaBrick.utils = VanillaBrick.utils || {};
VanillaBrick.utils.isPlainObject = isPlainObject;
VanillaBrick.utils.deepCloneOptions = deepCloneOptions;
VanillaBrick.utils.deepMergeOptions = deepMergeOptions;
VanillaBrick.utils.mergeOptions = mergeOptions;

})(window.VanillaBrick);

