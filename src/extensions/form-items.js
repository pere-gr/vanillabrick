VanillaBrick.extensions.items = {
    for: ['form'],
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
