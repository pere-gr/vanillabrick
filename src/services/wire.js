VanillaBrick.services.WireService = {
    kind: 'wire-service',
    events: [
        {
            for: 'wire:message',
            on: {
                fn: function (ev) {
                    const payload = ev.data || {};
                    this.brick.events.fire('wire:broadcast', payload);
                }
            }
        }
    ]
};
