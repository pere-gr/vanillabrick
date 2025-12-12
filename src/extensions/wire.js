VanillaBrick.extensions.wire = {
    for: ['*'], // Available to all bricks (except maybe services themselves? But services might want to use wire too)
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {
        send: function (eventName, data) {
            // Send message via wire
            this.events.fire('wire:outbound', { event: eventName, data: data });
        }
    },

    extension: {
        service: null,

        _connect: function () {
            if (this.service) return;

            // Connect to WireService
            if (VanillaBrick.service) {
                this.service = VanillaBrick.service('WireService');
            }

            if (this.service) {
                const self = this;
                // Listen to broadcasts
                // We need to listen to the service's events.
                // Assuming service is a brick structure with .events controller.
                this.service.events.on('wire:broadcast', function (ev) {
                    self._handleBroadcast(ev);
                });

                // Also listen for outbound from this brick to forward to service
                // (Handled in events below or directly via brick method calling internal helper?)
                // The brick method fires 'wire:outbound', so we listen to it here.
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
            for: 'brick:ready:*',
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
