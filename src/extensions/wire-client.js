export const wire = {
    for: [{ host: 'brick', kind: '*' }], // Available to all bricks
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {
        send: function (eventName, data) {
            console.warn("send", eventName, data);
            console.log("this", this);
            if (!this.service) this.ext._connect();
            if (!this.service) return; // Still no service?
            console.log("this.service", this.service);
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

            let wireKind = this.brick.options.get("wire", null);
            if (wireKind == null) return;

            // Connect to WireService
            if (globalThis.VanillaBrick && globalThis.VanillaBrick.service) {
                this.ext._service = globalThis.VanillaBrick.service('WireService');
            }

            if (this.ext._service) {
                if (this.ext._service.wire && typeof this.ext._service.wire.register === 'function') {
                    this.ext._service.wire.register(this.brick, this.brick.options.get("wire", {}));
                } else {
                    console.warn('[Wire Client] Service found but "wire" extension is missing or invalid on it.', this.ext._service);
                }
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


export default wire;

