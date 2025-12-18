export const wireservice = {
    for: [{ host: 'service', kind: 'wire' }], // Available to all bricks
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {
        register: function (brick, config) {
            console.log("register", brick, config);
        },
        login: function (brick, config) {
            console.log("login", this, brick, config);
        }
    },
    events: [
        {
            for: 'wire:send:register',
            on: {
                fn: function (ev) {
                    console.log("", ev)
                }
            }
        },
    ],
}


export default wireservice;

