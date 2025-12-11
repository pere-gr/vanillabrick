
  /**
   * Per-brick event bus controller.
   * Manages events shaped as "namespace:event:target" with phases before/on/after.
   * @constructor
   */
function EventBusController(brick) {
  this.brick = brick || null;
  this.handlers = []; // { pattern, compiled, phase, priority, handler }
  this.phases = ['before', 'on', 'after'];

  // Expose public EventBus API on the brick
  var bus = this;
  if (brick) {
    brick.events = {
      on: function (pattern, phase, priority, handler, meta) {
        bus.on(pattern, phase, priority, handler, meta);
        return brick; // permet chaining
      },
      off: function (pattern, phase, handler) {
        bus.off(pattern, phase, handler);
        return brick;
      },
      fire: function (eventName, payload) {
        bus.fire(eventName, payload);
        return brick;
      },
      fireAsync: function (eventName, payload) {
        return bus.fireAsync(eventName, payload);
      }
    };
  }
}

  // ---------- Internal utils ----------

  EventBusController.prototype._normalizePriority = function (priority) {
    let pr = typeof priority === 'number' ? priority : 5;
    if (pr < 0) pr = 0;
    if (pr > 10) pr = 10;
    return pr;
  };

  // pattern: "ns:event:target" with '*' as wildcard
  EventBusController.prototype._compilePattern = function (pattern) {
    const parts = (pattern || '').split(':');
    const ns = parts[0] || '*';
    const ev = parts[1] || '*';
    const target = parts[2];

    return {
      namespace: ns === '*' ? undefined : ns,
      event: ev === '*' ? undefined : ev,
      target: !target || target === '*' ? undefined : target,
    };
  };

  // eventName: "ns:event:target"
  EventBusController.prototype._parseEventKey = function (eventName) {
    const parts = (eventName || '').split(':');
    return {
      namespace: parts[0] || '',
      event: parts[1] || '',
      target: parts[2] || null,
    };
  };

  EventBusController.prototype._matches = function (compiled, key) {
    return (
      (compiled.namespace === undefined || compiled.namespace === key.namespace) &&
      (compiled.event === undefined || compiled.event === key.event) &&
      (compiled.target === undefined || compiled.target === key.target)
    );
  };

  // ---------- Subscription API ----------

  /**
   * Register a handler for a pattern and phase.
   * pattern: "ns:event:target" (supports '*')
   * phase: "before" | "on" | "after" (default "on")
   * priority: 0..10 (default 5, 0 = highest priority)
   */
  EventBusController.prototype.on = function (pattern, phase, priority, handler, meta) {
    // signature compatible: on(pattern, phase, priority, handler, meta)
    // phase optional, priority optional, meta optional
    if (typeof phase === 'function') {
      meta = handler;
      handler = phase;
      phase = 'on';
      priority = undefined;
    } else if (typeof priority === 'function' && typeof handler !== 'function') {
      meta = handler;
      handler = priority;
      priority = undefined;
    }
    if (typeof handler !== 'function') return;

    let ph = phase || 'on';
    if (this.phases.indexOf(ph) === -1) ph = 'on';

    const pr = this._normalizePriority(priority);

    this.handlers.push({
      pattern: pattern,
      compiled: this._compilePattern(pattern),
      phase: ph,
      handler: handler,
      priority: pr,
      meta: meta || null
    });

    // Sort by priority asc (0 = first)
    this.handlers.sort(function (a, b) {
      const pa = typeof a.priority === 'number' ? a.priority : 5;
      const pb = typeof b.priority === 'number' ? b.priority : 5;
      return pa - pb;
    });
  };

  /**
   * Unregister handlers filtered by pattern, phase and/or handler.
   */
  EventBusController.prototype.off = function (pattern, phase, handler) {
    for (let i = this.handlers.length - 1; i >= 0; i -= 1) {
      const h = this.handlers[i];
      if (pattern && h.pattern !== pattern) continue;
      if (phase && h.phase !== phase) continue;
      if (handler && h.handler !== handler) continue;
      this.handlers.splice(i, 1);
    }
  };

  // ---------- Pipeline execution (async core) ----------

  EventBusController.prototype._run = async function (eventName, payload) {
    const key = this._parseEventKey(eventName);
    const phases = this.phases;

    // Event object shared across phases
    const ev = {
      brick: this.brick || null,
      cancel: false, // if true, skip "on" phase
      data: payload,
      errors: [], // collected handler errors
      event:{
        phase: null, // "before" | "on" | "after"
        name: eventName, // "ns:event:target"
        namespace: key.namespace,
        event: key.event,
        target: key.target,
      },
      stopPhase: false, // if true, stop the current phase loop
    };

    for (let p = 0; p < phases.length; p += 1) {
      const phase = phases[p];

      // if canceled, skip "on" phase but still run others
      if (phase === 'on' && ev.cancel) continue;

      ev.event.phase = phase;

      for (let i = 0; i < this.handlers.length; i += 1) {
        const h = this.handlers[i];

        if (h.phase !== phase) continue;
        if (!this._matches(h.compiled, key)) continue;
        if (ev.stopPhase) break;

        try {
          const r = h.handler(ev, { brick: this.brick });
          if (r && typeof r.then === 'function') {
            await r; // support async handlers
          }
        } catch (err) {
          console.error('Error in handler', h.handler, { pattern: h.pattern, phase: h.phase, meta: h.meta }, err);
          ev.errors.push({ error: err, meta: h.meta, pattern: h.pattern, phase: h.phase });
          // on handler error, force cancel
          ev.cancel = true;
        }
      }
    }

    return ev;
  };

  // ---------- Public API ----------

  /**
   * Fire-and-forget event.
   * eventName: "ns:event:target"
   */
  EventBusController.prototype.fire = function (eventName, payload) {
    // Fire-and-forget; use fireAsync() if you need the final event object.
    this._run(eventName, payload);
  };

  /**
   * Fire an event and get a Promise with the final event object
   * (to inspect cancel/errors/meta).
   */
  EventBusController.prototype.fireAsync = function (eventName, payload) {
    return this._run(eventName, payload);
  };

  // ---------- Hook to global namespace ----------

  VanillaBrick.controllers = VanillaBrick.controllers || {};
  VanillaBrick.controllers.events = EventBusController;

