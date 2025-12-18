/**
 * Status Controller
 * Manages the lifecycle state of the brick via EventBus.
 * @constructor
 */
export default function StatusController(brick) {
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
