export const statusBar = {
    for: [{ host: 'brick', kind: 'status-bar' }],
    requires: ['html'],
    ns: 'statusBar',
    events: [
        {
            for: 'dom:row:focus',
            after: {
                fn: function (ev) {
                    const record = ev.data.row;
                    const el = this.brick.html.element();
                    if (el) {
                        el.textContent = `Wire OK -> Selected: ${record.name}`;
                    }
                }
            }
        }
    ],
    init: function () {
        const el = this.brick.html.element();
        if (el) el.textContent = 'Wire status: Waiting for table...';
    }
};

export default statusBar;
