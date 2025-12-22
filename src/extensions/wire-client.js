export const wire = {
    for: [{ host: 'brick', kind: '*' }], // Available to all bricks
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {
        notify: function (eventName, data) {
            //console.warn("WireClient > sending notify", eventName, data);
            //console.log("\tfor event", eventName);
            //console.log("\twith payload", data);
            if (!this.ext._service) this.ext._connect();
            if (!this.ext._service) return; // Still no service?
            this.ext._service.events.fire('wire:notify:out', {
                from: this.brick.id,
                event: eventName,
                data: data
            });
        },
        request: function (eventName, data) {
            //console.warn("request", eventName, data);
            //console.log("this", this);
            if (!this.ext._service) this.ext._connect();
            if (!this.ext._service) return; // Still no service?
            //console.log("this.service", this.ext._service);
            this.ext._service.events.fire('wire:request:out', {
                from: this.brick.id,
                event: eventName,
                data: data
            });
        },
    },

    extension: {
        _service: null,

        _connect: function () {

            if (this.ext._service) return;

            let wireKind = this.brick.options.get("wire", null);
            if (wireKind == null) return;

            // Connect to WireService
            if (globalThis.VanillaBrick && globalThis.VanillaBrick.service) {
                this.ext._service = globalThis.VanillaBrick.service('WireService');
            }

            if (this.ext._service) {
                this.ext._service.events.fire('wire:register:in', {
                    brick: this.brick,
                    options: this.brick.options.get("wire", {})
                });
            } else {
                console.warn('[Wire Client] No Wire Service found.', this.ext._service);
            }
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
    ],

    init: function () { },

    destroy: function () { }
};


export default wire;

