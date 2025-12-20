/**
 * Event Bus Controller (Global Singleton)
 * Manages events shaped as "namespace:event:target" with phases before/on/after.
 * @constructor
 */
export default function EventBusController() {
  // No per-brick state here yet (will use WeakMap later)
  this.phases = ['before', 'on', 'after']; // Shared constant
}

/**
 * Initialize event bus for a brick
 */
EventBusController.prototype.init = function (brick) {
  if (!brick || !brick._runtime) return;

  // Initialize per-brick state
  brick._runtime.events = {
    handlers: [],
    dispatchCache: {}
  };

  // Create public API
  const self = this;
  brick.events = {
    on: function (pattern, phase, priority, handler, meta) {
      self.on(brick, pattern, phase, priority, handler, meta);
      return brick;
    },
    off: function (pattern, phase, handler) {
      self.off(brick, pattern, phase, handler);
      return brick;
    },
    fire: function (eventName, payload) {
      self.fire(brick, eventName, payload);
      return brick;
    },
    fireAsync: function (eventName, payload) {
      return self.fireAsync(brick, eventName, payload);
    }
  };
};

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
EventBusController.prototype._getHandlersForEvent = function (brick, eventName, phase) {
  if (!brick || !brick._runtime || !brick._runtime.events) return phase ? [] : { before: [], on: [], after: [] };
  const state = brick._runtime.events;
  let handlersByPhase;

  if (state.dispatchCache[eventName]) {
    handlersByPhase = state.dispatchCache[eventName];
  } else {
    const key = this._parseEventKey(eventName);
    handlersByPhase = {
      before: [],
      on: [],
      after: []
    };

    for (let i = 0; i < state.handlers.length; i += 1) {
      const h = state.handlers[i];
      if (this._matches(h.compiled, key)) {
        if (handlersByPhase[h.phase]) {
          handlersByPhase[h.phase].push(h);
        }
      }
    }
    state.dispatchCache[eventName] = handlersByPhase;
  }

  if (phase) {
    return handlersByPhase[phase] || [];
  }

  return handlersByPhase;
};

// ---------- Subscription API ----------

/**
 * Register a handler for a pattern and phase.
 * pattern: "namespace:type:target" (supports '*')
 * phase: "before" | "on" | "after" (default "on")
 * priority: 0..10 (default 5, 0 = highest priority)
 */
EventBusController.prototype.on = function (brick, pattern, phase, priority, handler, meta) {
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
  if (!handler) return;
  // handler can be a function OR an object { fn, ctx, meta }

  let ph = phase || 'on';
  if (this.phases.indexOf(ph) === -1) ph = 'on';

  const pr = this._normalizePriority(priority);

  const state = brick._runtime.events;

  state.handlers.push({
    pattern: pattern,
    compiled: this._compilePattern(pattern),
    phase: ph,
    handler: handler,
    priority: pr,
    meta: meta || null
  });

  // Sort by priority asc (0 = first)
  state.handlers.sort(function (a, b) {
    const pa = typeof a.priority === 'number' ? a.priority : 5;
    const pb = typeof b.priority === 'number' ? b.priority : 5;
    return pa - pb;
  });

  // Invalidate cache on any subscription change
  state.dispatchCache = {};
};

/**
 * Unregister handlers filtered by pattern, phase and/or handler.
 */
EventBusController.prototype.off = function (brick, pattern, phase, handler) {
  if (!brick || !brick._runtime || !brick._runtime.events) return;
  const state = brick._runtime.events;

  for (let i = state.handlers.length - 1; i >= 0; i -= 1) {
    const h = state.handlers[i];
    if (pattern && h.pattern !== pattern) continue;
    if (phase && h.phase !== phase) continue;
    if (handler && h.handler !== handler) continue;
    state.handlers.splice(i, 1);
  }
  // Invalidate cache on any unsubscription
  state.dispatchCache = {};
};

// ---------- Pipeline execution (async core) ----------

/**
 * Internal phase execution.
 */
EventBusController.prototype._firePhase = async function (brick, phase, eventName, ev) {
  ev.event.phase = phase;
  ev.stopPhase = false;

  const phaseHandlers = this._getHandlersForEvent(brick, eventName, phase);
  const runtime = (globalThis.VanillaBrick) ? globalThis.VanillaBrick.runtime : null;

  for (let i = 0; i < phaseHandlers.length; i += 1) {
    if (ev.stopPhase) break;

    const h = phaseHandlers[i];
    const hnd = h.handler;

    try {
      let r;
      if (hnd && typeof hnd === 'object' && typeof hnd.fn === 'function') {
        // Execute via descriptor (Extension Handler)
        if (runtime) {
          r = runtime.execute(hnd.fn, hnd.ctx, [ev], hnd.meta);
        } else {
          r = hnd.fn.apply(hnd.ctx, [ev]);
        }
      } else if (typeof hnd === 'function') {
        // Legacy/Direct function case
        if (runtime) {
          r = runtime.execute(hnd, { brick: brick }, [ev], h.meta);
        } else {
          r = hnd(ev, { brick: brick });
        }
      }

      if (r && typeof r.then === 'function') {
        await r;
      }
    } catch (err) {
      console.error('Error in event handler execution:', err, { h, eventName, phase });
      ev.errors.push({ error: err, phase: phase, event: eventName });
      ev.cancel = true;
    }
  }

  return ev;
};

EventBusController.prototype._run = async function (brick, eventName, payload) {
  if (!brick || !brick._runtime || !brick._runtime.events) {
    return {
      event: { name: eventName },
      errors: [{ error: 'Event system not initialized for this brick' }],
      cancel: true
    };
  }

  // 1. Validation
  if (!this._validateEventName(eventName)) {
    return {
      event: { name: eventName },
      errors: [{ error: 'Invalid event name format or wildcards in dispatch' }],
      cancel: true
    };
  }

  // 2. Context Initialization
  const key = this._parseEventKey(eventName);
  const ev = {
    brick: brick || null,
    cancel: false,
    data: payload,
    errors: [],
    event: {
      phase: null,
      name: eventName,
      namespace: key.namespace,
      type: key.type,
      target: key.target,
    },
    stopPhase: false,
  };

  // 3. Sequential Phase Execution
  const phases = this.phases;
  for (let p = 0; p < phases.length; p += 1) {
    const phase = phases[p];
    if (phase === 'on' && ev.cancel) continue;
    await this._firePhase(brick, phase, eventName, ev);
  }

  return ev;
};

// ---------- Public API ----------

/**
 * Fire-and-forget event.
 * eventName: "namespace:type:target"
 */
EventBusController.prototype.fire = function (brick, eventName, payload) {
  // Fire-and-forget; use fireAsync() if you need the final event object.
  this._run(brick, eventName, payload);
};

/**
 * Fire an event and get a Promise with the final event object
 * (to inspect cancel/errors/meta).
 */
EventBusController.prototype.fireAsync = function (brick, eventName, payload) {
  return this._run(brick, eventName, payload);
};
