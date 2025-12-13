VanillaBrick.extensions.record = {
    for: ['form'],
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
