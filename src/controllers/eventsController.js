
/**
 * Per-brick event bus controller.
 * Manages events shaped as "namespace:event:target" with phases before/on/after.
 * @constructor
 */
function EventBusController(brick) {
  this.brick = brick || null;
  this.handlers = []; // { pattern, compiled, phase, priority, handler }
  this._dispatchCache = {};
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

/**
 * Compiles a subscription pattern.
 * Pattern format: "namespace:type:target"
 * Supports '*' as wildcard in any position.
 */
EventBusController.prototype._compilePattern = function (pattern) {
  const parts = (pattern || '').split(':');
  const ns = parts[0];
  const type = parts[1];
  const target = parts[2];

  return {
    namespace: !ns || ns === '*' ? undefined : ns,
    type: !type || type === '*' ? undefined : type,
    target: !target || target === '*' ? undefined : target,
  };
};

/**
 * Parses an event name into its components.
 * Format: "namespace:type:target"
 */
EventBusController.prototype._parseEventKey = function (eventName) {
  const parts = (eventName || '').split(':');
  return {
    namespace: parts[0] || '',
    type: parts[1] || '',
    target: parts[2] || '',
  };
};

EventBusController.prototype._matches = function (compiled, key) {
  return (
    (compiled.namespace === undefined || compiled.namespace === key.namespace) &&
    (compiled.type === undefined || compiled.type === key.type) &&
    (compiled.target === undefined || compiled.target === key.target)
  );
};

EventBusController.prototype._validateEventName = function (eventName) {
  if (typeof eventName !== 'string') {
    console.error('[EventBus] Event name must be a string.', eventName);
    return false;
  }
  const parts = eventName.split(':');

  // Strict 3-segment rule
  if (parts.length !== 3) {
    console.error('[EventBus] Invalid event name format. Expected exactly "namespace:type:target" (3 segments). Got:', eventName);
    return false;
  }

  // Validation for Dispatch: No empty parts, no wildcards allowed
  if (!parts[0] || parts[0] === '*' || !parts[1] || parts[1] === '*' || !parts[2] || parts[2] === '*') {
    console.error('[EventBus] Invalid event name for dispatch. Wildcards (*) and empty segments are not allowed in namespace, type, or target.', eventName);
    return false;
  }

  return true;
};

/**
 * Returns matched handlers grouped by phase for a specific event name.
 * Uses caching. The cache key is the full eventName string.
 */
EventBusController.prototype._getHandlersForEvent = function (eventName) {
  if (this._dispatchCache[eventName]) {
    return this._dispatchCache[eventName];
  }

  const key = this._parseEventKey(eventName);
  const result = {
    before: [],
    on: [],
    after: []
  };

  // this.handlers is expected to be sorted by priority globally
  for (let i = 0; i < this.handlers.length; i += 1) {
    const h = this.handlers[i];
    if (this._matches(h.compiled, key)) {
      if (result[h.phase]) {
        result[h.phase].push(h);
      }
    }
  }

  this._dispatchCache[eventName] = result;
  return result;
};

// ---------- Subscription API ----------

/**
 * Register a handler for a pattern and phase.
 * pattern: "namespace:type:target" (supports '*')
 * phase: "before" | "on" | "after" (default "on")
 * priority: 0..10 (default 5, 0 = highest priority)
 */
EventBusController.prototype.on = function (pattern, phase, priority, handler, meta) {
  // Signature compatibility: on(pattern, phase, priority, handler, meta)
  // Optional args shifting
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

  // Invalidate cache on any subscription change
  this._dispatchCache = {};
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
  // Invalidate cache on any unsubscription
  this._dispatchCache = {};
};

// ---------- Pipeline execution (async core) ----------

EventBusController.prototype._run = async function (eventName, payload) {
  // 1. Validation
  if (!this._validateEventName(eventName)) {
    // Return a dummy error object so awaits don't crash, but do not process
    return {
      event: { name: eventName },
      errors: [{ error: 'Invalid event name format or wildcards in dispatch' }],
      cancel: true
    };
  }

  // 2. Cache Lookup
  const phases = this.phases;
  const handlersByPhase = this._getHandlersForEvent(eventName);

  // We parse again just to populate the event meta object accurately
  const key = this._parseEventKey(eventName);

  // 3. Event Object Construction
  const ev = {
    brick: this.brick || null,
    cancel: false, // if true, skip "on" phase
    data: payload,
    errors: [], // collected handler errors
    event: {
      phase: null, // "before" | "on" | "after"
      name: eventName,
      namespace: key.namespace,
      type: key.type,   // Renamed from 'event' to 'type'
      target: key.target,
    },
    stopPhase: false, // if true, stop the current phase loop
  };

  // 4. Execution Loop
  for (let p = 0; p < phases.length; p += 1) {
    const phase = phases[p];

    // If canceled, skip "on" phase, but continue to "after"
    if (phase === 'on' && ev.cancel) continue;

    ev.event.phase = phase;
    const phaseHandlers = handlersByPhase[phase] || [];

    for (let i = 0; i < phaseHandlers.length; i += 1) {
      if (ev.stopPhase) break;

      const h = phaseHandlers[i];

      try {
        // Pass event and context
        const r = h.handler(ev, { brick: this.brick });
        if (r && typeof r.then === 'function') {
          await r; // support async handlers
        }
      } catch (err) {
        console.error('Error in handler', h.handler, { pattern: h.pattern, phase: h.phase, meta: h.meta }, err);
        ev.errors.push({ error: err, meta: h.meta, pattern: h.pattern, phase: h.phase });
        // Force cancel on error to prevent inconsistent state
        ev.cancel = true;
      }
    }
  }

  return ev;
};

// ---------- Public API ----------

/**
 * Fire-and-forget event.
 * eventName: "namespace:type:target"
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

