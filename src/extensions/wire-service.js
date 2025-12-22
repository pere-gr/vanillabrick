export const wireservice = {
    for: [{ host: 'service', kind: 'wire' }], // Available to all bricks
    requires: [], // No strict requirements
    ns: 'wire',
    options: {},

    brick: {},
    events: [
        {
            for: 'wire:notify:out',
            on: {
                fn: function (ev) {
                    //console.warn("WireService > on wire:notify:out", ev);

                    const master = ev.data.from;
                    //console.log("\tfrom", master);
                    const evName = ev.data.event;
                    //console.log("\tevName", evName);
                    const evData = ev.data.data;
                    //console.log("\tevData", evData);
                    const slaves = this.ext._slaves[master];
                    //console.log("\tfor slaves", slaves);
                    if (slaves && slaves.length > 0) {
                        for (let i = 0; i < slaves.length; i++) {
                            //console.log("\t- firing", evName, "in", slaves[i].brick.id);
                            slaves[i].brick.events.fire(evName, evData);
                        }
                    }
                }
            }
        },
        {
            for: 'wire:register:in',
            on: {
                fn: function (ev) {
                    this.ext._register(ev.data);
                }
            }
        },
    ],
    extension: {
        _register: function (data) {
            //console.warn("register", data.brick, data.options, this);
            if (data.options.master) {
                if (this.ext._bricks == null) this.ext._bricks = {};
                this.ext._bricks[data.brick.id] = data.brick;
            }
            if (data.options.slaveOf && data.options.slaveOf.length > 0) {
                if (this.ext._masters == null) this.ext._masters = {};
                if (this.ext._slaves == null) this.ext._slaves = {};
                for (let i = 0; i < data.options.slaveOf.length; i++) {
                    let master = this.ext._masters[data.brick.id];
                    if (!master) {
                        this.ext._masters[data.brick.id] = [];
                    }
                    this.ext._masters[data.brick.id].push({ id: data.options.slaveOf[i].id, kind: data.options.slaveOf[i].kind });

                    let slave = this.ext._slaves[data.options.slaveOf[i].id];
                    if (!slave) {
                        this.ext._slaves[data.options.slaveOf[i].id] = [];
                    }
                    this.ext._slaves[data.options.slaveOf[i].id].push({ id: data.brick.id, kind: data.brick.kind, brick: data.brick });
                }

            }
            //console.log("_bricks", this.ext._bricks);
            //console.log("_masters", this.ext._masters);
            //console.log("_slaves", this.ext._slaves);
        },
    }
}


export default wireservice;

