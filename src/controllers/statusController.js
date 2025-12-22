/**
 * Status Controller (Global Singleton)
 * Manages the lifecycle state of a brick (init, ready, destroyed, etc.)
 * @constructor
 */
export default function StatusController() {
    // No per-brick state here
}

/**
 * Initialize status for a brick
 * @param {Object} brick
 */
StatusController.prototype.init = function (brick) {
    if (!brick || !brick._runtime) return;
    brick._runtime.status = {
        value: 'initializing',
        listening: true
    };

    const self = this;
    brick.status = {
        get: () => self.get(brick),
        set: (status, payload) => self.set(brick, status, payload),
        is: (status) => self.is(brick, status)
    }
  };

/**
 * Get current status
 */
StatusController.prototype.get = function (brick) {
    return brick && brick._runtime && brick._runtime.status ? brick._runtime.status.value : undefined;
};

/**
 * Check if current status matches
 */
StatusController.prototype.is = function (brick, status) {
    if (!brick || !brick._runtime || !brick._runtime.status) return false;
    return brick._runtime.status.value === status;
};

/**
 * Set status and fire event
 */
StatusController.prototype.set = function (brick, newStatus, payload) {
    if (!brick || !brick._runtime || !brick._runtime.status) return;
    const state = brick._runtime.status;
    if (!state.listening) return;
    if (state.value === newStatus) return;

    const oldStatus = state.value;
    state.value = newStatus;

    // Fire generic change event
    if (brick.events) {
        brick.events.fire('brick:status:change', {
            from: oldStatus,
            to: newStatus,
            ...payload
        });

        // Fire specific event (e.g. brick:status:ready)
        brick.events.fire('brick:status:' + newStatus, payload);
    }

    if (newStatus === 'destroyed') {
        state.listening = false;
        // Cleanup events maybe? managed by destroy hook usually
    }
};
