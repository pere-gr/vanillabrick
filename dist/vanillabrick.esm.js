var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/brick/brick.js
function Brick(options) {
  const opts = options && typeof options === "object" ? Object.assign({}, options) : {};
  opts.id = opts.id || this._nextId();
  opts.host = (opts.host || "brick").toLowerCase();
  opts.kind = (opts.kind || "brick").toLowerCase();
  Object.defineProperty(this, "id", {
    value: opts.id,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, "host", {
    value: opts.host,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, "kind", {
    value: opts.kind,
    writable: false,
    configurable: false,
    enumerable: true
  });
  Object.defineProperty(this, "_runtime", {
    value: {},
    writable: false,
    configurable: false,
    enumerable: false
  });
  Object.defineProperty(this, "_controllers", {
    value: globalThis.VanillaBrick.runtime.controllers,
    writable: false,
    configurable: false,
    enumerable: false
  });
  const brick = this;
  const ctrl = this._controllers;
  if (ctrl.status)
    ctrl.status.init(brick);
  if (ctrl.options)
    ctrl.options.init(brick, opts);
  if (ctrl.events)
    ctrl.events.init(brick);
  if (ctrl.extensions)
    ctrl.extensions.init(brick);
  this.status = {
    get: () => ctrl.status.get(brick),
    set: (status, payload) => ctrl.status.set(brick, status, payload),
    is: (status) => ctrl.status.is(brick, status)
  };
  this.options = {
    get: (key, fallback) => ctrl.options.get(brick, key, fallback),
    set: (key, value) => {
      ctrl.options.setSync(brick, key, value);
      return brick;
    },
    setAsync: async (key, value) => {
      await ctrl.options.setAsync(brick, key, value);
      return brick;
    },
    has: (key) => ctrl.options.has(brick, key),
    all: () => ctrl.options.all(brick),
    setSilent: (key, value) => {
      ctrl.options.setSilent(brick, key, value);
      return brick;
    }
  };
  if (ctrl.extensions) {
    ctrl.extensions.applyAll(brick);
  }
  if (ctrl.status) {
    ctrl.status.set(brick, "ready", { options: opts });
  }
}
Brick.prototype.destroy = function() {
  this._controllers.status.set(this, "destroyed");
  if (this._runtime) {
    this._runtime.status = {};
    this._runtime.options = {};
    this._runtime.events = {};
    this._runtime.extensions = {};
  }
};
Object.defineProperty(Brick, "_idCounter", {
  value: 0,
  writable: true,
  configurable: false,
  enumerable: false
});
Object.defineProperty(Brick.prototype, "_nextId", {
  value: function() {
    Brick._idCounter += 1;
    return "brick-" + Brick._idCounter;
  },
  writable: false,
  configurable: false,
  enumerable: false
});

// src/controllers/extensionsRegistry.js
var ExtensionsRegistry = {
  /**
   * Retorna un array amb totes les definicions d'extensions
   * definides a la font (habitualment l'objecte d'extensions passat)
   */
  _cache: {},
  /**
   * Retorna un array amb totes les definicions d'extensions
   * filtrades per host/kind i amb dependències resoltes (topological sort).
   *
   * @param {Object} brick - Instancia del brick o objecte de metadates {host:'brick', kind:'table'}
   */
  all: function(brick) {
    if (!brick || typeof brick !== "object") {
      console.warn("ExtensionsRegistry.all() called without brick context");
      return [];
    }
    const host = (brick.host || "brick").toLowerCase();
    const kind = (brick.kind || "").toLowerCase();
    if (!kind)
      return [];
    const cacheKey = host + "::" + kind;
    if (this._cache[cacheKey]) {
      return this._cache[cacheKey];
    }
    const src = globalThis.VanillaBrick && globalThis.VanillaBrick.extensions || {};
    const candidates = {};
    const seenExtensions = /* @__PURE__ */ new Set();
    function normalizeRule(rule) {
      if (!rule || typeof rule !== "object")
        return null;
      const rHost = (rule.host || "brick").toLowerCase();
      const rKind = typeof rule.kind === "string" ? rule.kind.toLowerCase() : "";
      if (!rKind)
        return null;
      return { host: rHost, kind: rKind };
    }
    function matchesRule(rule, currentHost, currentKind) {
      if (!rule)
        return false;
      const hostMatch = rule.host === "*" || rule.host === currentHost;
      const kindMatch = rule.kind === "*" || rule.kind === currentKind;
      return hostMatch && kindMatch;
    }
    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key))
        continue;
      const def = src[key];
      if (!def || typeof def !== "object")
        continue;
      if (seenExtensions.has(def))
        continue;
      if (!def._name)
        def._name = def.ns || key;
      const rules = def.for;
      if (!Array.isArray(rules) || !rules.length) {
        console.warn("VanillaBrick extension without valid `for` array, skipped", def._name || key);
        continue;
      }
      let match = false;
      for (let ri = 0; ri < rules.length; ri += 1) {
        const rule = normalizeRule(rules[ri]);
        if (!rule)
          continue;
        if (matchesRule(rule, host, kind)) {
          match = true;
          break;
        }
      }
      if (match) {
        candidates[key] = { name: key, ext: def };
        seenExtensions.add(def);
      }
    }
    const sortedList = [];
    const status = {};
    function visit(name) {
      if (status[name] === "ok")
        return true;
      if (status[name] === "visiting")
        return false;
      if (status[name] === "missing")
        return false;
      let candidate = candidates[name];
      if (!candidate) {
        for (const k in candidates) {
          if (candidates[k].ext.ns === name) {
            candidate = candidates[k];
            break;
          }
        }
      }
      if (!candidate) {
        status[name] = "missing";
        return false;
      }
      status[name] = "visiting";
      const reqs = candidate.ext.requires || candidate.ext._requires;
      if (Array.isArray(reqs)) {
        for (let i = 0; i < reqs.length; i++) {
          const depName = reqs[i];
          if (!visit(depName)) {
            status[name] = "missing";
            return false;
          }
        }
      }
      status[name] = "ok";
      sortedList.push(candidate);
      return true;
    }
    for (const name in candidates) {
      visit(name);
    }
    this._cache[cacheKey] = sortedList;
    return sortedList;
  },
  /**
   * Genera els prototips i contextos per a un brick específic o de forma genèrica.
   * Aquesta funció es crida una vegada per tipus d'extensió per generar els "motlles".
   */
  _bake: function(defs) {
    const prototypes = {};
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const name = def.name || def.ext.ns;
      const protoExt = {
        _name: name,
        _def: def.ext
      };
      if (def.ext.extension && typeof def.ext.extension === "object") {
        for (const k in def.ext.extension) {
          if (typeof def.ext.extension[k] === "function") {
            protoExt[k] = def.ext.extension[k];
          }
        }
      }
      const protoApi = {};
      if (def.ext.brick) {
        for (const k in def.ext.brick) {
          if (typeof def.ext.brick[k] === "function") {
            (function(methodName, methodFn, extName) {
              protoApi[methodName] = function() {
                const extData = this._extData && this._extData[extName];
                if (!extData) {
                  console.warn(`VanillaBrick: Extension data not found for ${extName} in namespace API call ${methodName}`);
                  return;
                }
                const args = Array.prototype.slice.call(arguments);
                const runtime = globalThis.VanillaBrick ? globalThis.VanillaBrick.runtime : null;
                if (runtime && typeof runtime.execute === "function") {
                  const meta = {
                    type: "brick-api",
                    ext: extName,
                    brick: extData.ctx.brick ? extData.ctx.brick.id : "unknown",
                    fnName: methodName
                  };
                  return runtime.execute(methodFn, extData.ctx, args, meta);
                }
                return methodFn.apply(extData.ctx, args);
              };
            })(k, def.ext.brick[k], name);
          }
        }
      }
      prototypes[name] = {
        ext: protoExt,
        api: protoApi
      };
    }
    return prototypes;
  }
};
var extensionsRegistry_default = ExtensionsRegistry;

// src/controllers/runtimeController.js
function RuntimeController() {
}
RuntimeController.prototype.execute = function(fn, context, args, meta) {
  "use strict";
  if (typeof fn !== "function") {
    const brickId = meta && meta.brick || context && context.brick && context.brick.id || "unknown";
    console.warn(`[RuntimeController] Attempted to execute non-function for brick ${brickId}`, meta);
    return void 0;
  }
  try {
    const result = fn.apply(context, args);
    if (result && typeof result.then === "function") {
      return result.catch(function(err) {
        this._handleError(err, fn, context, meta);
        return Promise.reject(err);
      }.bind(this));
    }
    return result;
  } catch (err) {
    this._handleError(err, fn, context, meta);
    throw err;
  }
};
RuntimeController.prototype._handleError = function(err, fn, context, meta) {
  var brickCtx = context && context.brick ? context.brick : context;
  if (!brickCtx || !brickCtx.id) {
    if (meta && meta.brick) {
      brickCtx = { id: meta.brick };
    }
  }
  const errorInfo = {
    error: err,
    message: err.message || String(err),
    stack: err.stack,
    meta: meta || {},
    context: {
      brick: brickCtx && brickCtx.id ? brickCtx.id : null,
      kind: brickCtx && brickCtx.kind ? brickCtx.kind : null
    }
  };
  try {
    errorInfo.fnSource = fn.toString();
  } catch (e) {
    errorInfo.fnSource = "[unable to capture source]";
  }
  console.error("[RuntimeController] Error executing developer code:", errorInfo);
};

// src/controllers/statusController.js
function StatusController() {
}
StatusController.prototype.init = function(brick) {
  if (!brick || !brick._runtime)
    return;
  brick._runtime.status = {
    value: "initializing",
    listening: true
  };
};
StatusController.prototype.get = function(brick) {
  return brick && brick._runtime && brick._runtime.status ? brick._runtime.status.value : void 0;
};
StatusController.prototype.is = function(brick, status) {
  if (!brick || !brick._runtime || !brick._runtime.status)
    return false;
  return brick._runtime.status.value === status;
};
StatusController.prototype.set = function(brick, newStatus, payload) {
  if (!brick || !brick._runtime || !brick._runtime.status)
    return;
  const state = brick._runtime.status;
  if (!state.listening)
    return;
  if (state.value === newStatus)
    return;
  const oldStatus = state.value;
  state.value = newStatus;
  if (brick.events) {
    brick.events.fire("brick:status:change", __spreadValues({
      from: oldStatus,
      to: newStatus
    }, payload));
    brick.events.fire("brick:status:" + newStatus, payload);
  }
  if (newStatus === "destroyed") {
    state.listening = false;
  }
};

// src/utils/options.js
var options_exports = {};
__export(options_exports, {
  getOption: () => getOption,
  mergeOptions: () => mergeOptions,
  setOption: () => setOption
});
function mergeOptions() {
  const result = {};
  for (let i = 0; i < arguments.length; i++) {
    const source = arguments[i];
    if (!source || typeof source !== "object")
      continue;
    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key))
        continue;
      const sVal = source[key];
      const rVal = result[key];
      if (sVal && typeof sVal === "object" && !Array.isArray(sVal) && rVal && typeof rVal === "object" && !Array.isArray(rVal)) {
        result[key] = mergeOptions(rVal, sVal);
      } else {
        result[key] = sVal;
      }
    }
  }
  return result;
}
function getOption(obj, path) {
  if (!obj || !path)
    return void 0;
  if (!path.indexOf("."))
    return obj[path];
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === void 0 || current === null)
      return void 0;
    current = current[parts[i]];
  }
  return current;
}
function setOption(obj, path, value) {
  if (!obj || !path)
    return;
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (current[p] === void 0 || current[p] === null) {
      current[p] = {};
    }
    current = current[p];
  }
  current[parts[parts.length - 1]] = value;
}

// src/controllers/optionsController.js
function OptionsController() {
}
OptionsController.prototype.init = function(brick, initialOptions) {
  if (!brick || !brick._runtime)
    return;
  brick._runtime.options = {
    data: initialOptions || {},
    cache: {}
  };
};
OptionsController.prototype.all = function(brick) {
  return brick && brick._runtime && brick._runtime.options ? brick._runtime.options.data : {};
};
OptionsController.prototype.has = function(brick, key) {
  const data = brick && brick._runtime && brick._runtime.options ? brick._runtime.options.data : {};
  const val = getOption(data, key);
  return val !== void 0;
};
OptionsController.prototype.get = function(brick, key, fallback) {
  const state = brick && brick._runtime ? brick._runtime.options : null;
  if (!state)
    return fallback;
  if (state.cache && Object.prototype.hasOwnProperty.call(state.cache, key)) {
    return state.cache[key];
  }
  const val = getOption(state.data, key);
  const result = val === void 0 ? fallback : val;
  if (state.cache) {
    state.cache[key] = result;
  }
  return result;
};
OptionsController.prototype.setSync = function(brick, key, value) {
  const state = brick && brick._runtime ? brick._runtime.options : null;
  if (!state)
    return;
  const old = this.get(brick, key);
  if (old === value)
    return;
  setOption(state.data, key, value);
  state.cache = {};
  if (brick.events) {
    brick.events.fire("brick:option:changed", { key, value, oldValue: old });
    brick.events.fire("brick:option:changed:" + key, { value, oldValue: old });
  }
};
OptionsController.prototype.setSilent = function(brick, key, value) {
  const state = brick && brick._runtime ? brick._runtime.options : null;
  if (!state)
    return;
  setOption(state.data, key, value);
  state.cache = {};
};
OptionsController.prototype.setAsync = async function(brick, key, value) {
  this.setSync(brick, key, value);
  return Promise.resolve();
};

// src/controllers/eventsController.js
function EventBusController() {
  this.phases = ["before", "on", "after"];
}
EventBusController.prototype.init = function(brick) {
  if (!brick || !brick._runtime)
    return;
  brick._runtime.events = {
    handlers: [],
    dispatchCache: {}
  };
  const self = this;
  brick.events = {
    on: function(pattern, phase, priority, handler, meta) {
      self.on(brick, pattern, phase, priority, handler, meta);
      return brick;
    },
    off: function(pattern, phase, handler) {
      self.off(brick, pattern, phase, handler);
      return brick;
    },
    fire: function(eventName, payload) {
      self.fire(brick, eventName, payload);
      return brick;
    },
    fireAsync: function(eventName, payload) {
      return self.fireAsync(brick, eventName, payload);
    }
  };
};
EventBusController.prototype._normalizePriority = function(priority) {
  let pr = typeof priority === "number" ? priority : 5;
  if (pr < 0)
    pr = 0;
  if (pr > 10)
    pr = 10;
  return pr;
};
EventBusController.prototype._compilePattern = function(pattern) {
  const parts = (pattern || "").split(":");
  const ns = parts[0];
  const type = parts[1];
  const target = parts[2];
  return {
    namespace: !ns || ns === "*" ? void 0 : ns,
    type: !type || type === "*" ? void 0 : type,
    target: !target || target === "*" ? void 0 : target
  };
};
EventBusController.prototype._parseEventKey = function(eventName) {
  const parts = (eventName || "").split(":");
  return {
    namespace: parts[0] || "",
    type: parts[1] || "",
    target: parts[2] || ""
  };
};
EventBusController.prototype._matches = function(compiled, key) {
  return (compiled.namespace === void 0 || compiled.namespace === key.namespace) && (compiled.type === void 0 || compiled.type === key.type) && (compiled.target === void 0 || compiled.target === key.target);
};
EventBusController.prototype._validateEventName = function(eventName) {
  if (typeof eventName !== "string") {
    console.error("[EventBus] Event name must be a string.", eventName);
    return false;
  }
  const parts = eventName.split(":");
  if (parts.length !== 3) {
    console.error('[EventBus] Invalid event name format. Expected exactly "namespace:type:target" (3 segments). Got:', eventName);
    return false;
  }
  if (!parts[0] || parts[0] === "*" || !parts[1] || parts[1] === "*" || !parts[2] || parts[2] === "*") {
    console.error("[EventBus] Invalid event name for dispatch. Wildcards (*) and empty segments are not allowed in namespace, type, or target.", eventName);
    return false;
  }
  return true;
};
EventBusController.prototype._getHandlersForEvent = function(brick, eventName, phase) {
  if (!brick || !brick._runtime || !brick._runtime.events)
    return phase ? [] : { before: [], on: [], after: [] };
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
EventBusController.prototype.on = function(brick, pattern, phase, priority, handler, meta) {
  if (typeof phase === "function") {
    meta = handler;
    handler = phase;
    phase = "on";
    priority = void 0;
  } else if (typeof priority === "function" && typeof handler !== "function") {
    meta = handler;
    handler = priority;
    priority = void 0;
  }
  if (!handler)
    return;
  let ph = phase || "on";
  if (this.phases.indexOf(ph) === -1)
    ph = "on";
  const pr = this._normalizePriority(priority);
  const state = brick._runtime.events;
  state.handlers.push({
    pattern,
    compiled: this._compilePattern(pattern),
    phase: ph,
    handler,
    priority: pr,
    meta: meta || null
  });
  state.handlers.sort(function(a, b) {
    const pa = typeof a.priority === "number" ? a.priority : 5;
    const pb = typeof b.priority === "number" ? b.priority : 5;
    return pa - pb;
  });
  state.dispatchCache = {};
};
EventBusController.prototype.off = function(brick, pattern, phase, handler) {
  if (!brick || !brick._runtime || !brick._runtime.events)
    return;
  const state = brick._runtime.events;
  for (let i = state.handlers.length - 1; i >= 0; i -= 1) {
    const h = state.handlers[i];
    if (pattern && h.pattern !== pattern)
      continue;
    if (phase && h.phase !== phase)
      continue;
    if (handler && h.handler !== handler)
      continue;
    state.handlers.splice(i, 1);
  }
  state.dispatchCache = {};
};
EventBusController.prototype._firePhase = async function(brick, phase, eventName, ev) {
  ev.event.phase = phase;
  ev.stopPhase = false;
  const phaseHandlers = this._getHandlersForEvent(brick, eventName, phase);
  const runtime = globalThis.VanillaBrick ? globalThis.VanillaBrick.runtime : null;
  for (let i = 0; i < phaseHandlers.length; i += 1) {
    if (ev.stopPhase)
      break;
    const h = phaseHandlers[i];
    const hnd = h.handler;
    try {
      let r;
      if (hnd && typeof hnd === "object" && typeof hnd.fn === "function") {
        if (runtime) {
          r = runtime.execute(hnd.fn, hnd.ctx, [ev], hnd.meta);
        } else {
          r = hnd.fn.apply(hnd.ctx, [ev]);
        }
      } else if (typeof hnd === "function") {
        if (runtime) {
          r = runtime.execute(hnd, { brick }, [ev], h.meta);
        } else {
          r = hnd(ev, { brick });
        }
      }
      if (r && typeof r.then === "function") {
        await r;
      }
    } catch (err) {
      console.error("Error in event handler execution:", err, { h, eventName, phase });
      ev.errors.push({ error: err, phase, event: eventName });
      ev.cancel = true;
    }
  }
  return ev;
};
EventBusController.prototype._run = async function(brick, eventName, payload) {
  if (!brick || !brick._runtime || !brick._runtime.events) {
    return {
      event: { name: eventName },
      errors: [{ error: "Event system not initialized for this brick" }],
      cancel: true
    };
  }
  if (!this._validateEventName(eventName)) {
    return {
      event: { name: eventName },
      errors: [{ error: "Invalid event name format or wildcards in dispatch" }],
      cancel: true
    };
  }
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
      target: key.target
    },
    stopPhase: false
  };
  const phases = this.phases;
  for (let p = 0; p < phases.length; p += 1) {
    const phase = phases[p];
    if (phase === "on" && ev.cancel)
      continue;
    await this._firePhase(brick, phase, eventName, ev);
  }
  return ev;
};
EventBusController.prototype.fire = function(brick, eventName, payload) {
  this._run(brick, eventName, payload);
};
EventBusController.prototype.fireAsync = function(brick, eventName, payload) {
  return this._run(brick, eventName, payload);
};

// src/controllers/extensionsController.js
function parseForPattern(pattern) {
  if (!pattern)
    return { ns: "", action: "", target: "*" };
  const bits = String(pattern).split(":");
  const ns = bits[0] || "";
  const action = bits[1] || "";
  let target = bits.length > 2 ? bits.slice(2).join(":") : "*";
  if (!target)
    target = "*";
  return { ns, action, target };
}
function ExtensionsController() {
}
function getRuntime() {
  return globalThis.VanillaBrick && globalThis.VanillaBrick.runtime ? globalThis.VanillaBrick.runtime : null;
}
ExtensionsController.prototype.init = function(brick) {
  if (!brick || !brick._runtime)
    return;
  brick._runtime.extensions = {
    map: {},
    // Map of installed extensions { name: ctxExt }
    destroyHook: false
  };
};
ExtensionsController.prototype.applyAll = function(brick) {
  const registry = extensionsRegistry_default;
  if (!registry || typeof registry.all !== "function")
    return;
  const defs = registry.all(brick) || [];
  if (defs.length == 0) {
    return;
  }
  const runtime = getRuntime();
  if (runtime) {
    if (!runtime.prototypes) {
      runtime.prototypes = {};
    }
    const baked = registry._bake(defs);
    Object.assign(runtime.prototypes, baked);
  }
  const optionsCtrl = brick._controllers && brick._controllers.options;
  if (!mergeOptions || typeof mergeOptions !== "function") {
    console.error("mergeOptions is missing; cannot merge extension defaults safely");
  } else if (optionsCtrl && typeof optionsCtrl.get === "function") {
    const userOptions = brick._runtime && brick._runtime.options ? brick._runtime.options.data : {};
    const kind = (brick.kind || "").toLowerCase();
    const coreDefaults = [];
    const extDefaults = [];
    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i];
      const defOpts = def.ext.options || def.ext._options;
      if (!defOpts)
        continue;
      const defName = (def.ext.ns || def.name || "").toLowerCase();
      if (defName && kind && defName === kind + "-core") {
        coreDefaults.push(defOpts);
      } else {
        extDefaults.push(defOpts);
      }
    }
    const mergedOptions = mergeOptions.apply(null, coreDefaults.concat(extDefaults, [userOptions]));
    if (brick._runtime && brick._runtime.options) {
      brick._runtime.options.data = mergedOptions;
      brick._runtime.options.cache = {};
    }
  }
  for (let i = 0; i < defs.length; i += 1) {
    this._install(brick, defs[i]);
  }
  this._ensureDestroyHook(brick);
};
ExtensionsController.prototype._install = function(brick, def) {
  const name = def.name || def.ext.ns || null;
  const ns = def.ext.ns || name;
  if (!name) {
    console.warn("VanillaBrick extension without name/ns, skipped", def);
    return;
  }
  const extState = brick && brick._runtime ? brick._runtime.extensions : null;
  if (!extState)
    return;
  if (extState.map[name])
    return;
  const runtime = getRuntime();
  const protos = runtime && runtime.prototypes ? runtime.prototypes[name] : null;
  let ctxExt;
  if (protos && protos.ext) {
    ctxExt = Object.create(protos.ext);
    ctxExt.brick = brick;
    ctxExt.ext = ctxExt;
    ctxExt._ctx = ctxExt;
  } else {
    const ext = {
      name,
      def: def.ext,
      brick
    };
    ctxExt = Object.create(ext);
    ctxExt.brick = brick;
    ctxExt.ext = ext;
    ctxExt._ctx = ctxExt;
  }
  Object.defineProperty(ctxExt, "options", { value: brick.options, writable: false, enumerable: false, configurable: true });
  Object.defineProperty(ctxExt, "events", { value: brick.events, writable: false, enumerable: false, configurable: true });
  Object.defineProperty(ctxExt, "status", { value: brick.status, writable: false, enumerable: false, configurable: true });
  const ctxApi = ctxExt;
  if (!protos) {
    if (def.ext.extension && typeof def.ext.extension === "object") {
      for (const k in def.ext.extension) {
        if (!Object.prototype.hasOwnProperty.call(def.ext.extension, k))
          continue;
        const fn = def.ext.extension[k];
        if (typeof fn === "function") {
          const meta = { type: "extension-private", ext: name, brick: brick.id, fnName: k };
          ctxExt[k] = function() {
            const args = Array.prototype.slice.call(arguments);
            if (runtime && typeof runtime.execute === "function") {
              return runtime.execute(fn, ctxExt, args, meta);
            }
            return fn.apply(ctxExt, args);
          };
        }
      }
    }
  }
  if (typeof def.ext.init === "function") {
    try {
      let res;
      if (runtime && typeof runtime.execute === "function") {
        res = runtime.execute(def.ext.init, ctxExt, [], {
          type: "init",
          ext: name,
          brick: brick.id,
          fnName: "init"
        });
      } else {
        res = def.ext.init.call(ctxExt);
      }
      if (res === false)
        return;
    } catch (err) {
      console.error('VanillaBrick extension "' + name + '" init() failed', err);
      return;
    }
  }
  if (def.ext.brick && typeof def.ext.brick === "object") {
    if (!brick[ns]) {
      brick[ns] = { _extData: {} };
    }
    const nsObj = brick[ns];
    if (!nsObj._extData)
      nsObj._extData = {};
    if (protos && protos.api) {
      Object.assign(nsObj, protos.api);
      nsObj._extData[name] = { ctx: ctxApi, fns: def.ext.brick, meta: {} };
    } else {
      for (const apiName in def.ext.brick) {
        if (!Object.prototype.hasOwnProperty.call(def.ext.brick, apiName))
          continue;
        const apiFn = def.ext.brick[apiName];
        if (typeof apiFn !== "function")
          continue;
        const meta = { type: "brick-api", ext: name, brick: brick.id, fnName: ns + "." + apiName };
        nsObj[apiName] = function() {
          const args = Array.prototype.slice.call(arguments);
          if (runtime && typeof runtime.execute === "function") {
            return runtime.execute(apiFn, ctxApi, args, meta);
          }
          return apiFn.apply(ctxApi, args);
        };
      }
    }
  }
  if (Array.isArray(def.ext.events) && def.ext.events.length) {
    if (brick.events && typeof brick.events.on === "function") {
      for (let li = 0; li < def.ext.events.length; li += 1) {
        const evt = def.ext.events[li];
        if (!evt)
          continue;
        const parsed = parseForPattern(evt.for);
        const pattern = parsed.ns + ":" + parsed.action + ":" + parsed.target;
        ["before", "on", "after"].forEach(function(phase) {
          const desc = evt[phase];
          if (!desc || typeof desc.fn !== "function")
            return;
          const pr = typeof desc.priority === "number" ? desc.priority : void 0;
          const meta = {
            type: "event",
            ext: name,
            brick: brick.id,
            event: pattern,
            phase,
            fnName: desc.fn.name || "anon"
          };
          const handler = function(ev) {
            const args = [ev];
            if (runtime && typeof runtime.execute === "function") {
              return runtime.execute(desc.fn, ctxExt, args, meta);
            }
            return desc.fn.apply(ctxExt, args);
          };
          brick.events.on(pattern, phase, pr, handler, { ext: name, fn: desc.fn.name });
        });
      }
    }
  }
  extState.map[name] = ctxExt;
};
ExtensionsController.prototype._ensureDestroyHook = function(brick) {
  const extState = brick && brick._runtime ? brick._runtime.extensions : null;
  if (!extState)
    return;
  if (extState.destroyHook)
    return;
  if (!brick || !brick.events || typeof brick.events.on !== "function") {
    return;
  }
  extState.destroyHook = true;
  brick.events.on(
    "brick:status:destroyed",
    "on",
    0,
    // High priority
    function() {
      const runtime = getRuntime();
      for (const name in extState.map) {
        if (!Object.prototype.hasOwnProperty.call(extState.map, name))
          continue;
        const ctxExt = extState.map[name];
        const def = ctxExt._def ? { destroy: ctxExt._def.destroy, ns: ctxExt._name } : ctxExt.def || {};
        if (typeof def.destroy === "function") {
          try {
            if (runtime && typeof runtime.execute === "function") {
              runtime.execute(def.destroy, ctxExt, [], {
                type: "destroy",
                ext: name,
                brick: brick.id,
                fnName: "destroy"
              });
            } else {
              def.destroy.call(ctxExt);
            }
          } catch (err) {
            console.error('VanillaBrick extension "' + name + '" destroy() failed', err);
          }
        }
      }
      extState.map = {};
    }
  );
};

// src/startup/services.js
function setupServices(VanillaBrick2) {
  VanillaBrick2.runtime.services = VanillaBrick2.runtime.services || {};
  VanillaBrick2.service = function(name) {
    if (VanillaBrick2.runtime.services[name]) {
      return VanillaBrick2.runtime.services[name];
    }
    return VanillaBrick2.base.serviceStart(name);
  };
  VanillaBrick2.base.serviceStart = function(name) {
    if (VanillaBrick2.runtime.services[name]) {
      return VanillaBrick2.runtime.services[name];
    }
    const def = VanillaBrick2.services[name];
    if (!def) {
      console.warn("Service definition not found:", name);
      return null;
    }
    const opts = Object.assign({}, def);
    opts.id = name;
    opts.host = "service";
    opts.kind = opts.kind || "service";
    const brick = new VanillaBrick2.brick(opts);
    VanillaBrick2.runtime.services[name] = brick;
    if (VanillaBrick2.runtime.bricks && Array.isArray(VanillaBrick2.runtime.bricks)) {
      VanillaBrick2.runtime.bricks.push(brick);
    }
    return brick;
  };
  VanillaBrick2.base.serviceStop = function(name) {
    const service = VanillaBrick2.runtime.services[name];
    if (!service)
      return;
    if (service.destroy)
      service.destroy();
    delete VanillaBrick2.runtime.services[name];
  };
}

// src/startup/bootstrap.js
function setupBootstrap(VanillaBrick2) {
  VanillaBrick2.base = VanillaBrick2.base || {};
  VanillaBrick2.configs = VanillaBrick2.configs || {};
  const registry = {
    list: [],
    byId: {}
  };
  function loadConfigs(scope) {
    if (typeof document === "undefined")
      return;
    const root = scope || document;
    if (!root.querySelectorAll)
      return;
    const scripts = root.querySelectorAll('script[type="application/json"][data-brick]');
    for (let i = 0; i < scripts.length; i += 1) {
      const node = scripts[i];
      const raw = node.textContent || "";
      if (!raw.trim())
        continue;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
          continue;
        for (const key in parsed) {
          if (!Object.prototype.hasOwnProperty.call(parsed, key))
            continue;
          const base = VanillaBrick2.configs[key] && typeof VanillaBrick2.configs[key] === "object" ? VanillaBrick2.configs[key] : {};
          const next = parsed[key];
          if (!next || typeof next !== "object")
            continue;
          VanillaBrick2.configs[key] = Object.assign({}, base, next);
        }
      } catch (err) {
        console.warn("VanillaBrick: invalid JSON in data-brick config", err);
      }
    }
  }
  function readKind(el) {
    if (!el)
      return void 0;
    const k = el.getAttribute("brick-kind") || el.getAttribute("data-kind") || el.getAttribute("data-brick-kind") || el.dataset && (el.dataset.kind || el.dataset.brickKind);
    return k ? String(k).toLowerCase() : void 0;
  }
  function createBrickFromElement(el) {
    if (!el)
      return null;
    if (el.__brickInstance)
      return el.__brickInstance;
    const opts = {};
    const config = el.id && VanillaBrick2.configs ? VanillaBrick2.configs[el.id] : null;
    if (config && typeof config === "object") {
      Object.assign(opts, config);
    }
    if (el.id) {
      opts.id = el.id;
    }
    const kind = readKind(el);
    if (kind) {
      opts.kind = kind;
    }
    opts.html = {
      id: el.id || null,
      element: el
    };
    const brick = new VanillaBrick2.brick(opts);
    el.__brickInstance = brick;
    registry.list.push(brick);
    registry.byId[brick.id] = brick;
    console.log("Brick", el.id, brick);
    return brick;
  }
  function bootstrap(root) {
    if (typeof document === "undefined")
      return [];
    const scope = root || document;
    if (!scope.querySelectorAll)
      return [];
    loadConfigs(scope);
    const nodes = scope.querySelectorAll(".vb");
    const created = [];
    for (let i = 0; i < nodes.length; i++) {
      const brick = createBrickFromElement(nodes[i]);
      if (brick)
        created.push(brick);
    }
    return created;
  }
  VanillaBrick2.base.bootstrap = bootstrap;
  VanillaBrick2.runtime = VanillaBrick2.runtime || {};
  VanillaBrick2.runtime.bricks = registry.list || [];
  VanillaBrick2.base.getBrick = function(id) {
    return registry.byId[id] || null;
  };
  if (typeof document !== "undefined") {
    let runOnce = function() {
      if (bootstrapped)
        return;
      bootstrapped = true;
      bootstrap();
    };
    var bootstrapped = false;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        runOnce();
      });
    } else {
      setTimeout(runOnce, 0);
    }
  }
}

// src/extensions/html-css.js
var htmlCss = {
  for: [{ host: "brick", kind: "*" }],
  requires: ["html"],
  ns: "css",
  options: {},
  brick: {
    addClass: function(el, className) {
      if (!el || !className)
        return;
      if (el.classList && el.classList.add) {
        el.classList.add(className);
      } else {
        const cur = el.className || "";
        if ((" " + cur + " ").indexOf(" " + className + " ") === -1) {
          el.className = (cur ? cur + " " : "") + className;
        }
      }
    },
    removeClass: function(el, className) {
      if (!el || !className)
        return;
      if (el.classList && el.classList.remove) {
        el.classList.remove(className);
      } else {
        const cur = el.className || "";
        el.className = (" " + cur + " ").replace(" " + className + " ", " ").trim();
      }
    },
    hasClass: function(el, className) {
      if (!el || !className)
        return false;
      if (el.classList && el.classList.contains)
        return el.classList.contains(className);
      const cur = el.className || "";
      return (" " + cur + " ").indexOf(" " + className + " ") !== -1;
    },
    toggleClass: function(el, className, force) {
      if (!el || !className)
        return;
      if (el.classList && typeof el.classList.toggle === "function") {
        if (typeof force === "boolean")
          el.classList.toggle(className, force);
        else
          el.classList.toggle(className);
      } else {
        const has = this.css.hasClass(className);
        if (typeof force === "boolean") {
          if (force && !has)
            this.css.addClass(className);
          if (!force && has)
            this.css.removeClass(className);
        } else {
          if (has)
            this.css.removeClass(className);
          else
            this.css.addClass(className);
        }
      }
    },
    show: function(el) {
      if (!el)
        return;
      el.style.display = "";
    },
    hide: function(el) {
      if (!el)
        return;
      el.style.display = "none";
    },
    setStyle: function(el, prop, value) {
      if (!el || !prop)
        return;
      el.style[prop] = value;
    },
    getStyle: function(el, prop) {
      if (!el || !prop || typeof window === "undefined" || !window.getComputedStyle)
        return null;
      const cs = window.getComputedStyle(el);
      return cs ? cs.getPropertyValue(prop) || cs[prop] : null;
    },
    setVar: function(el, name, value) {
      if (!el || !name)
        return;
      if (name.indexOf("--") !== 0)
        name = "--" + name;
      el.style.setProperty(name, value);
    },
    getVar: function(el, name) {
      if (!el || !name || typeof window === "undefined" || !window.getComputedStyle)
        return null;
      if (name.indexOf("--") !== 0)
        name = "--" + name;
      const cs = window.getComputedStyle(el);
      return cs ? cs.getPropertyValue(name) : null;
    }
  },
  extension: {},
  events: [],
  init: function() {
    if (!this.brick || !this.brick.html || typeof this.brick.html.element !== "function") {
      console.warn("VanillaBrick htmlCss requires html extension active", this.brick && this.brick.id);
      return false;
    }
    const el = this.brick.html.element();
    if (!el) {
      console.warn("VanillaBrick htmlCss: no DOM element resolved", this.brick && this.brick.id);
      return false;
    }
    return true;
  },
  destroy: function() {
  }
};
var html_css_default = htmlCss;

// src/extensions/html-events.js
var htmlEvents = {
  for: [{ host: "brick", kind: "*" }],
  requires: ["html"],
  ns: "html",
  options: {},
  brick: {
    on: function(el, type, handler, options) {
      if (!el || typeof el.addEventListener !== "function" || typeof handler !== "function")
        return;
      el.addEventListener(type, handler, options);
      let listeners = this.brick.options.get("html.listeners", []);
      if (!Array.isArray(listeners))
        listeners = [];
      listeners.push({ el, type, handler, options, source: "api" });
      this.brick.options.setSilent("html.listeners", listeners);
    },
    off: function(el, type, handler, options) {
      if (!el || typeof el.removeEventListener !== "function" || typeof handler !== "function")
        return;
      el.removeEventListener(type, handler, options);
      const listeners = this.brick.options.get("html.listeners", []);
      if (!Array.isArray(listeners))
        return;
      for (let i = listeners.length - 1; i >= 0; i -= 1) {
        const ln = listeners[i];
        if (ln.type === type && ln.handler === handler) {
          listeners.splice(i, 1);
        }
      }
      this.brick.options.setSilent("html.listeners", listeners);
    }
  },
  extension: {},
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          const el = this.brick.html.element();
          if (!el || typeof el.addEventListener !== "function")
            return;
          let listeners = this.brick.options.get("html.events.listeners", []);
          if (!Array.isArray(listeners))
            listeners = [];
          const self = this;
          const defaultMap = [
            { type: "click", eventName: "html:event:click" },
            { type: "mouseenter", eventName: "html:event:mouseenter" },
            { type: "mouseleave", eventName: "html:event:mouseleave" },
            { type: "mousedown", eventName: "html:event:mousedown" },
            { type: "mouseup", eventName: "html:event:mouseup" }
          ];
          for (let i = 0; i < defaultMap.length; i += 1) {
            const entry = defaultMap[i];
            const handler = function handler2(domEvent) {
              self.brick.events.fire(entry.eventName, {
                domEvent,
                element: el
              });
            };
            this.brick.html.on(el, entry.type, handler);
          }
        }
      }
    },
    {
      for: "brick:status:destroyed",
      before: {
        fn: function() {
          const el = this.brick && this.brick.html.element && this.brick.html.element();
          if (!el || typeof el.removeEventListener !== "function")
            return;
          const listeners = this.brick.options.get("html.events.listeners", []);
          if (!Array.isArray(listeners))
            return;
          for (let i = 0; i < listeners.length; i += 1) {
            const ln = listeners[i];
            this.brick.html.off(el, ln.type, ln.handler, ln.options);
          }
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var html_events_default = htmlEvents;

// src/extensions/html-render.js
var htmlRender = {
  for: [{ host: "brick", kind: "*" }],
  requires: ["html"],
  ns: "html",
  options: {},
  brick: {
    // Safe getters/creators
    get: function(selectorOrTag) {
      if (!selectorOrTag)
        return null;
      const root = this.html && typeof this.html.element === "function" ? this.html.element() : null;
      if (!root || !root.querySelector)
        return null;
      if (selectorOrTag.toLowerCase && root.tagName && selectorOrTag.toLowerCase() === root.tagName.toLowerCase()) {
        return root;
      }
      return root.querySelector(selectorOrTag) || null;
    },
    create: function(tag, props) {
      if (!tag || typeof document === "undefined")
        return null;
      const el = document.createElement(tag);
      const cfg = props || {};
      if (cfg.text !== void 0 && cfg.text !== null) {
        el.textContent = cfg.text;
      }
      if (cfg.html !== void 0 && cfg.html !== null && this.html && typeof this.html.sanitize === "function") {
        el.innerHTML = this.html.sanitize(String(cfg.html));
      }
      if (cfg.attrs && typeof cfg.attrs === "object") {
        for (const k in cfg.attrs) {
          if (Object.prototype.hasOwnProperty.call(cfg.attrs, k) && cfg.attrs[k] !== void 0) {
            el.setAttribute(k, cfg.attrs[k]);
          }
        }
      }
      if (cfg.classList && Array.isArray(cfg.classList)) {
        el.classList.add.apply(el.classList, cfg.classList);
      }
      if (cfg.dataset && typeof cfg.dataset === "object") {
        for (const k in cfg.dataset) {
          if (Object.prototype.hasOwnProperty.call(cfg.dataset, k) && cfg.dataset[k] !== void 0) {
            el.dataset[k] = cfg.dataset[k];
          }
        }
      }
      return el;
    },
    frag: function() {
      return typeof document !== "undefined" && document.createDocumentFragment ? document.createDocumentFragment() : null;
    },
    append: function(target, nodeOrFrag) {
      if (!target || !nodeOrFrag || !target.appendChild)
        return;
      target.appendChild(nodeOrFrag);
    },
    prepend: function(target, nodeOrFrag) {
      if (!target || !nodeOrFrag || !target.insertBefore)
        return;
      if (!target.firstChild) {
        target.appendChild(nodeOrFrag);
      } else {
        target.insertBefore(nodeOrFrag, target.firstChild);
      }
    },
    replace: function(target, nodeOrFrag) {
      if (!target || !target.replaceChildren)
        return;
      target.replaceChildren(nodeOrFrag);
    },
    clear: function(target) {
      if (!target || !target.replaceChildren)
        return;
      target.replaceChildren();
    },
    setSafe: function(el, htmlString) {
      if (!el)
        return;
      if (!htmlString) {
        el.innerHTML = "";
        return;
      }
      if (this.html && typeof this.html.sanitize === "function") {
        el.innerHTML = this.html.sanitize(String(htmlString));
      } else {
        el.textContent = String(htmlString);
      }
    },
    sanitize: function(htmlString) {
      if (!htmlString)
        return "";
      if (typeof DOMParser === "undefined") {
        return String(htmlString).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(htmlString), "text/html");
      const scripts = doc.querySelectorAll("script, style, iframe, object, embed");
      scripts.forEach(function(node) {
        if (node && node.parentNode)
          node.parentNode.removeChild(node);
      });
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const attrs = Array.prototype.slice.call(node.attributes || []);
        for (let i = 0; i < attrs.length; i++) {
          const a = attrs[i];
          const name = a.name.toLowerCase();
          const val = a.value || "";
          if (name.startsWith("on")) {
            node.removeAttribute(a.name);
            continue;
          }
          if ((name === "href" || name === "src") && /^javascript:/i.test(val)) {
            node.removeAttribute(a.name);
          }
        }
      }
      return doc.body.innerHTML || "";
    },
    // Render helpers
    queueRender: function(fn) {
      if (typeof fn !== "function")
        return;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(fn);
      } else {
        setTimeout(fn, 0);
      }
    },
    batch: function(items, chunkSize, renderChunk) {
      const arr = Array.isArray(items) ? items : [];
      const size = typeof chunkSize === "number" && chunkSize > 0 ? chunkSize : 100;
      const render = typeof renderChunk === "function" ? renderChunk : null;
      if (!render)
        return Promise.resolve();
      let index = 0;
      return new Promise((resolve) => {
        const step = () => {
          const slice = arr.slice(index, index + size);
          if (slice.length) {
            render(slice, index);
            index += size;
            this.queueRender(step.bind(this));
          } else {
            resolve();
          }
        };
        step();
      });
    }
  },
  extension: {},
  events: [],
  init: function() {
    return true;
  },
  destroy: function() {
  }
};
var html_render_default = htmlRender;

// src/extensions/html.js
var html = {
  for: [{ host: "brick", kind: "*" }],
  requires: [],
  ns: "html",
  options: {},
  brick: {
    element: function() {
      return this.options.get("html.element", null);
    },
    on: function(type, handler, options) {
      const el = this.options.get("html.element", null);
      if (!el || typeof el.addEventListener !== "function" || typeof handler !== "function")
        return;
      el.addEventListener(type, handler, options);
      let listeners = this.options.get("html.listeners", []);
      if (!Array.isArray(listeners))
        listeners = [];
      listeners.push({ type, handler, options, source: "api" });
      this.options.setSilent("html.listeners", listeners);
    },
    off: function(type, handler, options) {
      const el = this.options.get("html.element", null);
      if (!el || typeof el.removeEventListener !== "function" || typeof handler !== "function")
        return;
      el.removeEventListener(type, handler, options);
      const listeners = this.options.get("html.listeners", []);
      if (!Array.isArray(listeners))
        return;
      for (let i = listeners.length - 1; i >= 0; i -= 1) {
        const ln = listeners[i];
        if (ln.type === type && ln.handler === handler) {
          listeners.splice(i, 1);
        }
      }
      this.options.setSilent("html.listeners", listeners);
    }
  },
  extension: {
    _resolveElement: function(value) {
      if (!value)
        return null;
      if (typeof Element !== "undefined" && value instanceof Element)
        return value;
      if (value && value.nodeType === 1)
        return value;
      if (typeof value === "function") {
        try {
          return value();
        } catch (err) {
          return null;
        }
      }
      return null;
    },
    _resolveById: function(id) {
      if (!id || typeof id !== "string")
        return null;
      if (typeof document === "undefined")
        return null;
      return document.getElementById(id) || null;
    }
  },
  events: [],
  init: function() {
    if (!this.brick)
      return false;
    const elemOpt = this.brick.options.get("html.element", null);
    const idOpt = this.brick.options.get("html.id", null);
    let el = this._resolveElement(elemOpt);
    if (!el && idOpt) {
      el = this._resolveById(idOpt);
    }
    if (!el) {
      console.warn("VanillaBrick html extension requires a DOM element (options.html.element) or a valid options.html.id", this.brick.id);
      return false;
    }
    if (elemOpt && !this._resolveElement(elemOpt)) {
      console.warn("VanillaBrick html element must be a DOM node or factory, not an id. Use options.html.id to resolve by id.", this.brick.id);
    }
    this.brick.options.set("html.element", el);
    return true;
  },
  destroy: function() {
    const el = this.brick.options.get("html.element", null);
    const listeners = this.brick.options.get("html.listeners", null);
    ;
    if (el && Array.isArray(listeners)) {
      for (let i = 0; i < listeners.length; i += 1) {
        const ln = listeners[i];
        if (ln && ln.type && ln.handler) {
          el.removeEventListener(ln.type, ln.handler, ln.options);
        }
      }
    }
  }
};
var html_default = html;

// src/extensions/store.js
var DATA_SAMPLE_ROWS = [
  { code: "1", name: "one", key: 1 },
  { code: "2", name: "two", key: 2 },
  { code: "3", name: "three", key: 3 },
  { code: "4", name: "four", key: 4 },
  { code: "5", name: "five", key: 5 },
  { code: "6", name: "six", key: 6 },
  { code: "7", name: "seven", key: 7 },
  { code: "8", name: "eight", key: 8 },
  { code: "9", name: "nine", key: 9 },
  { code: "10", name: "ten", key: 10 },
  { code: "11", name: "eleven", key: 11 },
  { code: "12", name: "twelve", key: 12 },
  { code: "13", name: "thirteen", key: 13 },
  { code: "14", name: "fourteen", key: 14 },
  { code: "15", name: "fifteen", key: 15 },
  { code: "16", name: "sixteen", key: 16 },
  { code: "17", name: "seventeen", key: 17 },
  { code: "18", name: "eighteen", key: 18 },
  { code: "19", name: "nineteen", key: 19 },
  { code: "20", name: "twenty", key: 20 }
];
var store = {
  for: [
    { host: "brick", kind: "form" },
    { host: "brick", kind: "table" }
  ],
  requires: [],
  ns: "store",
  options: {},
  // API pública sobre el brick (this === brick)
  brick: {
    load: function() {
      return this.brick.options.get("store.data", []);
    },
    set: function(data) {
      if (data === null)
        return;
      const previous = this.brick.options.get("store.data", []);
      data = Array.isArray(data) ? data.slice() : [data];
      this.brick.events.fire("store:data:set", {
        previous,
        data
      });
      return data;
    },
    setAsync: async function(data) {
      const previous = this.brick.options.get("store.data", []);
      data = Array.isArray(data) ? data.slice() : [];
      await this.brick.events.fireAsync("store:data:set", {
        previous,
        data
      });
      return data;
    },
    all: function() {
      return this.brick.store.load();
    },
    get: function(index) {
      const arr = this.brick.store.load();
      if (typeof index !== "number")
        return null;
      if (index < 0 || index >= arr.length)
        return null;
      return arr[index];
    }
  },
  // Helpers interns (this === ext)
  extension: {
    _normalizeArray: function(value, fallback) {
      if (Array.isArray(value))
        return value.slice();
      return Array.isArray(fallback) ? fallback.slice() : [];
    },
    _sortRows: function(rows, field, dir, compareFn) {
      const arr = Array.isArray(rows) ? rows.slice() : [];
      const cmp = typeof compareFn === "function" ? function(a, b) {
        return compareFn(a, b, dir);
      } : function(a, b) {
        const va = a && Object.prototype.hasOwnProperty.call(a, field) ? a[field] : void 0;
        const vb = b && Object.prototype.hasOwnProperty.call(b, field) ? b[field] : void 0;
        let res = 0;
        if (va === vb)
          res = 0;
        else if (va === void 0 || va === null)
          res = -1;
        else if (vb === void 0 || vb === null)
          res = 1;
        else if (typeof va === "number" && typeof vb === "number")
          res = va - vb;
        else
          res = String(va).localeCompare(String(vb));
        return dir === "desc" ? -res : res;
      };
      arr.sort(cmp);
      return arr;
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function(ev) {
          const storeData = this._normalizeArray(DATA_SAMPLE_ROWS, []);
          this.brick.options.setSilent("store.data", storeData);
        }
      }
    },
    {
      for: "store:data:set",
      on: {
        fn: function(ev) {
          const payload = ev && ev.data || null;
          const data = payload && payload.data ? payload.data : [];
          this.brick.options.setSilent("store.data", data);
        }
      }
    },
    {
      for: "store:data:sort",
      on: {
        fn: function(ev) {
          const payload = ev && ev.data || {};
          const field = payload.field || null;
          const dir = payload.dir || "asc";
          if (!field || !this.brick)
            return;
          const sorted = this._sortRows(this.brick.store.load(), field, dir, payload.compare);
          this.brick.options.setSilent("store.data", sorted);
          ev.field = field;
          ev.dir = dir;
          ev.data = sorted;
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var store_default = store;

// src/extensions/wire-client.js
var wire = {
  for: [{ host: "brick", kind: "*" }],
  // Available to all bricks
  requires: [],
  // No strict requirements
  ns: "wire",
  options: {},
  brick: {
    notify: function(eventName, data) {
      console.warn("WireClient > sending notify", eventName, data);
      console.log("	for event", eventName);
      console.log("	with payload", data);
      if (!this.ext._service)
        this.ext._connect();
      if (!this.ext._service)
        return;
      this.ext._service.events.fire("wire:notify:out", {
        from: this.brick.id,
        event: eventName,
        data
      });
    },
    request: function(eventName, data) {
      console.warn("request", eventName, data);
      console.log("this", this);
      if (!this.ext._service)
        this.ext._connect();
      if (!this.ext._service)
        return;
      console.log("this.service", this.ext._service);
      this.ext._service.events.fire("wire:request:out", {
        from: this.brick.id,
        event: eventName,
        data
      });
    }
  },
  extension: {
    _service: null,
    _connect: function() {
      if (this.ext._service)
        return;
      let wireKind = this.brick.options.get("wire", null);
      if (wireKind == null)
        return;
      if (globalThis.VanillaBrick && globalThis.VanillaBrick.service) {
        this.ext._service = globalThis.VanillaBrick.service("WireService");
      }
      if (this.ext._service) {
        this.ext._service.events.fire("wire:register:in", {
          brick: this.brick,
          options: this.brick.options.get("wire", {})
        });
      } else {
        console.warn("[Wire Client] No Wire Service found.", this.ext._service);
      }
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          this._connect();
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var wire_client_default = wire;

// src/extensions/wire-service.js
var wireservice = {
  for: [{ host: "service", kind: "wire" }],
  // Available to all bricks
  requires: [],
  // No strict requirements
  ns: "wire",
  options: {},
  brick: {},
  events: [
    {
      for: "wire:notify:out",
      on: {
        fn: function(ev) {
          console.warn("WireService > on wire:notify:out", ev);
          const master = ev.data.from;
          console.log("	from", master);
          const evName = ev.data.event;
          console.log("	evName", evName);
          const evData = ev.data.data;
          console.log("	evData", evData);
          const slaves = this.ext._slaves[master];
          console.log("	for slaves", slaves);
          if (slaves && slaves.length > 0) {
            for (let i = 0; i < slaves.length; i++) {
              console.log("	- firing", evName, "in", slaves[i].brick.id);
              slaves[i].brick.events.fire(evName, evData);
            }
          }
        }
      }
    },
    {
      for: "wire:register:in",
      on: {
        fn: function(ev) {
          this.ext._register(ev.data);
        }
      }
    }
  ],
  extension: {
    _register: function(data) {
      console.warn("register", data.brick, data.options, this);
      if (data.options.master) {
        if (this.ext._bricks == null)
          this.ext._bricks = {};
        this.ext._bricks[data.brick.id] = data.brick;
      }
      if (data.options.slaveOf && data.options.slaveOf.length > 0) {
        if (this.ext._masters == null)
          this.ext._masters = {};
        if (this.ext._slaves == null)
          this.ext._slaves = {};
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
      console.log("_bricks", this.ext._bricks);
      console.log("_masters", this.ext._masters);
      console.log("_slaves", this.ext._slaves);
    }
  }
};
var wire_service_default = wireservice;

// src/components/form-items.js
var formItems = {
  for: [{ host: "brick", kind: "form" }],
  requires: ["html"],
  ns: "items",
  options: {},
  brick: {
    get: function() {
      return this.options.get("form.items", []);
    }
  },
  extension: {
    _parseFromDom: function() {
      const root = this.brick.html.element();
      if (!root)
        return [];
      const items = [];
      const groups = root.querySelectorAll(".vb-form-group");
      for (let i = 0; i < groups.length; i++) {
        const groupEl = groups[i];
        const group = {
          type: "group",
          items: []
        };
        const fields = groupEl.querySelectorAll(".vb-form-field");
        for (let j = 0; j < fields.length; j++) {
          const fieldEl = fields[j];
          const input = fieldEl.querySelector("input, select, textarea");
          const label = fieldEl.querySelector("label");
          if (input) {
            const fieldItem = {
              type: "field",
              name: input.name || input.id,
              label: label ? label.textContent : "",
              controlType: input.tagName.toLowerCase(),
              inputType: input.type,
              required: input.required,
              placeholder: input.placeholder,
              // Detect span from parent column if exists
              span: this._detectSpan(fieldEl)
            };
            group.items.push(fieldItem);
          }
        }
        items.push(group);
      }
      return items;
    },
    _detectSpan: function(el) {
      let current = el;
      while (current && !current.classList.contains("vb-row")) {
        if (current.className && typeof current.className === "string") {
          const match = current.className.match(/vb-span-(\d+)/);
          if (match)
            return parseInt(match[1], 10);
        }
        current = current.parentElement;
        if (!current || current.tagName === "FORM")
          break;
      }
      return 12;
    },
    _render: function(items) {
      const root = this.brick.html.element();
      if (!root)
        return;
      root.innerHTML = "";
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type !== "group")
          continue;
        const groupEl = document.createElement("div");
        groupEl.className = "vb-form-group";
        const rowEl = document.createElement("div");
        rowEl.className = "vb-row";
        if (item.items && item.items.length) {
          for (let j = 0; j < item.items.length; j++) {
            const field = item.items[j];
            const span = field.span || 12;
            const colEl = document.createElement("div");
            colEl.className = "vb-span-" + span;
            const fieldContainer = document.createElement("div");
            fieldContainer.className = "vb-form-field";
            if (field.label) {
              const label = document.createElement("label");
              label.textContent = field.label;
              if (field.name)
                label.htmlFor = field.name;
              fieldContainer.appendChild(label);
            }
            let input;
            if (field.controlType === "textarea") {
              input = document.createElement("textarea");
            } else if (field.controlType === "select") {
              input = document.createElement("select");
            } else {
              input = document.createElement("input");
              input.type = field.inputType || "text";
            }
            if (field.name) {
              input.name = field.name;
              input.id = field.name;
            }
            if (field.placeholder)
              input.placeholder = field.placeholder;
            if (field.required === true || field.required === "true" || field.required === "required") {
              input.required = true;
            }
            fieldContainer.appendChild(input);
            colEl.appendChild(fieldContainer);
            rowEl.appendChild(colEl);
          }
        }
        groupEl.appendChild(rowEl);
        root.appendChild(groupEl);
      }
    }
  },
  events: [
    {
      for: "brick:status:ready",
      before: {
        fn: function(ev) {
          let items = [];
          if (this.brick.options.has("form.items")) {
            items = this.brick.options.get("form.items");
          }
          if (!items || items.length === 0) {
            const root = this.brick.html.element();
            if (root) {
              const configVar = root.getAttribute("brick-form-items") || root.getAttribute("data-form-items");
              if (configVar && window[configVar]) {
                console.log("[Form Items] Config var found", configVar);
                items = window[configVar];
                this.brick.options.set("form.items", items);
              }
            }
            if (!items || items.length === 0) {
              console.log("[Form Items] Parsing from DOM", this.brick.id);
              items = this._parseFromDom();
              this.brick.options.set("form.items", items);
            }
          } else {
            console.log("[Form Items] Config found in options", items);
          }
          ev.data = ev.data || {};
          ev.data.formItems = items;
        }
      },
      on: {
        fn: function(ev) {
          const items = ev.data.formItems || this.brick.options.get("form.items");
          if (items && items.length > 0) {
            this._render(items);
          }
        }
      }
    }
  ],
  init: function() {
    return true;
  },
  destroy: function() {
  }
};
var form_items_default = formItems;

// src/components/form-record.js
var formRecord = {
  for: [{ host: "brick", kind: "form" }],
  requires: ["html", "store"],
  ns: "record",
  options: {},
  brick: {
    // We could expose methods to get/set the current record directly if needed
    getRecord: function() {
      const data = this.store.load();
      return data && data.length ? data[0] : null;
    }
  },
  extension: {
    _bind: function(record) {
      const root = this.brick.html.element();
      if (!root)
        return;
      const inputs = root.querySelectorAll("input, select, textarea");
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const name = input.name || input.id;
        if (!name)
          continue;
        if (record && Object.prototype.hasOwnProperty.call(record, name)) {
          input.value = record[name];
        } else {
          if (!record)
            input.value = "";
        }
      }
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function(ev) {
          const data = this.brick.store.load();
          if (data && data.length) {
            this._bind(data[0]);
          }
        }
      }
    },
    {
      for: "store:data:*",
      after: {
        fn: function(ev) {
          const data = this.brick.store.load();
          const record = data && data.length ? data[0] : null;
          this._bind(record);
        }
      }
    },
    {
      for: "dom:row:focus",
      after: {
        fn: function(ev) {
          console.warn("Form > master focused a row", ev);
          const record = ev.data.row;
          console.log("	record", record);
          this._bind(record);
        }
      }
    }
  ],
  init: function() {
    return true;
  },
  destroy: function() {
  }
};
var form_record_default = formRecord;

// src/components/form.js
var form = {
  for: [{ host: "brick", kind: "form" }],
  requires: ["html"],
  ns: "form",
  options: {
    items: []
  },
  brick: {
    // Basic form component methods can be added here
    submit: function() {
      const el = this.dom.element();
      if (el && typeof el.submit === "function")
        el.submit();
    },
    reset: function() {
      const el = this.dom.element();
      if (el && typeof el.reset === "function")
        el.reset();
    }
  },
  extension: {
    // Internal extension logic
  },
  events: [
    // Basic lifecycle events
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
        }
      }
    }
  ],
  init: function() {
    return true;
  },
  destroy: function() {
  }
};
var form_default = form;

// src/components/status-bar.js
var statusBar = {
  for: [{ host: "brick", kind: "status-bar" }],
  requires: ["html"],
  ns: "statusBar",
  events: [
    {
      for: "dom:row:focus",
      after: {
        fn: function(ev) {
          const record = ev.data.row;
          const el = this.brick.html.element();
          if (el) {
            el.textContent = `Wire OK -> Selected: ${record.name}`;
          }
        }
      }
    }
  ],
  init: function() {
    const el = this.brick.html.element();
    if (el)
      el.textContent = "Wire status: Waiting for table...";
  }
};
var status_bar_default = statusBar;

// src/components/table-columns.js
var tableColumns = {
  for: [{ host: "brick", kind: "table" }],
  requires: ["html", "store"],
  ns: "columns",
  brick: {
    get: function() {
      return this.options.get("table.columns", []);
    },
    sort: function(field, dir) {
      const cols = this.brick.columns.get();
      const colDef = cols.find(function(c) {
        return c && c.datafield === field;
      }) || {};
      const state = this.options.get("table.sort", { field: null, dir: null });
      let nextDir = dir;
      if (nextDir !== "asc" && nextDir !== "desc") {
        nextDir = state.field === field && state.dir === "asc" ? "desc" : "asc";
      }
      this.events.fire("store:data:sort", {
        field,
        dir: nextDir,
        compare: typeof colDef.sort === "function" ? colDef.sort : null
      });
      return nextDir;
    }
  },
  extension: {},
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          const columns = this.brick.columns.get();
          const root = this.brick.html.element && this.brick.html.element();
          if (!root)
            return;
          const table2 = root.tagName && root.tagName.toLowerCase() === "table" ? root : root.querySelector && root.querySelector("table");
          if (!table2)
            return;
          let thead = table2.tHead ? table2.tHead : table2.querySelector("thead");
          if (!thead) {
            thead = table2.createTHead ? table2.createTHead() : table2.insertBefore(document.createElement("thead"), table2.firstChild);
          }
          const row = thead.rows && thead.rows[0] ? thead.rows[0] : thead.insertRow();
          row.innerHTML = "";
          const brick = this.brick;
          for (let i = 0; i < columns.length; i += 1) {
            const col = columns[i] || {};
            const th = document.createElement("th");
            th.textContent = col.label || col.datafield || "";
            if (col.sortable && col.datafield) {
              th.classList.add("vb-sortable");
              th.addEventListener("click", /* @__PURE__ */ function(colDef) {
                return function() {
                  brick.columns.sort(colDef.datafield, null);
                };
              }(col));
            }
            row.appendChild(th);
          }
        }
      }
    },
    {
      for: "store:data:sort",
      after: {
        fn: function(ev) {
          this.brick.options.setSilent("table.sort", { field: ev.field, dir: ev.dir || "asc" });
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  },
  options: {
    table: {
      columns: [
        { datafield: "code", label: "Code", sortable: true },
        { datafield: "name", label: "Name", sortable: true }
      ]
    }
  }
};
var table_columns_default = tableColumns;

// src/components/table-rows-focused.js
var tableRowsFocused = {
  for: [{ host: "brick", kind: "table" }],
  requires: ["html", "rows", "store"],
  ns: "rowsFocused",
  options: {},
  brick: {},
  extension: {
    _addTabIndex: function() {
      const el = this.brick.html.element();
      if (!el)
        return;
      const rows = el.querySelectorAll("tbody tr") || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.hasAttribute("tabindex")) {
          row.setAttribute("tabindex", i);
        }
      }
    },
    _handleFocus: function(target) {
      const el = this.brick.html.element();
      if (!el)
        return;
      const row = target.closest("tr");
      if (!row)
        return;
      const old = el.querySelector("tr.vb-focused");
      if (old)
        old.classList.remove("vb-focused");
      row.classList.add("vb-focused");
      const rowIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
      const data = this.brick.store.get(rowIndex);
      this.brick.events.fire("dom:row:focus", {
        index: rowIndex,
        row: data,
        element: row
      });
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          const el = this.brick.html.element();
          if (el) {
            const self = this;
            el.addEventListener("focusin", function(e) {
              self._handleFocus(e.target);
            });
          }
          this._addTabIndex();
        }
      }
    },
    {
      for: "store:data:set",
      after: {
        fn: function(ev) {
          this._addTabIndex();
        }
      }
    },
    {
      for: "store:data:sort",
      after: {
        fn: function() {
          this._addTabIndex();
        }
      }
    },
    {
      for: "dom:row:focus",
      after: {
        fn: function(ev) {
          var _a;
          (_a = this.brick.wire) == null ? void 0 : _a.notify("dom:row:focus", ev.data);
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var table_rows_focused_default = tableRowsFocused;

// src/components/table-rows.js
var tableRows = {
  for: [{ host: "brick", kind: "table" }],
  requires: ["html", "store", "columns"],
  ns: "rows",
  options: {},
  brick: {
    render: function() {
      const root = this.brick.html.element();
      if (!root)
        return;
      const table2 = root.tagName && root.tagName.toLowerCase() === "table" ? root : root.querySelector && root.querySelector("table");
      if (!table2)
        return;
      const columns = this.brick.columns.get();
      const rows = this.brick.store.load();
      let tbody = table2.tBodies && table2.tBodies.length ? table2.tBodies[0] : table2.querySelector("tbody");
      if (!tbody) {
        tbody = document.createElement("tbody");
        table2.appendChild(tbody);
      }
      tbody.innerHTML = "";
      for (let r = 0; r < rows.length; r += 1) {
        const record = rows[r] || {};
        const tr = document.createElement("tr");
        for (let c = 0; c < columns.length; c += 1) {
          const col = columns[c] || {};
          const field = col.datafield;
          const td = document.createElement("td");
          td.textContent = field && record[field] !== void 0 && record[field] !== null ? record[field] : "";
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    }
  },
  extension: {},
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          this.brick.rows.render();
        }
      }
    },
    {
      for: "store:data:*",
      after: {
        fn: function(ev) {
          this.brick.rows.render();
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var table_rows_default = tableRows;

// src/components/table.js
var table = {
  for: [{ host: "brick", kind: "table" }],
  requires: ["html"],
  ns: "table",
  options: {},
  brick: {
    refresh: function() {
      if (this.__tableExt)
        this.__tableExt._refreshRows();
    },
    getSelection: function() {
      const ext = this.__tableExt;
      if (!ext)
        return { index: -1, row: null };
      const idx = typeof ext.selectedIndex === "number" ? ext.selectedIndex : -1;
      const row = idx >= 0 && ext.rows && ext.rows[idx] ? ext.rows[idx] : null;
      return { index: idx, row };
    },
    clearSelection: function() {
      if (this.__tableExt)
        this.__tableExt._setSelectedIndex(-1);
    }
  },
  extension: {
    table: null,
    rows: [],
    selectedIndex: -1,
    _findTable: function() {
      const root = this.brick.html && typeof this.brick.html.element === "function" ? this.brick.html.element() : null;
      if (!root || !root.querySelector) {
        this.table = null;
        return null;
      }
      const table2 = root.querySelector("table.vb-table") || root.querySelector("table");
      this.table = table2 || null;
      return this.table;
    },
    _refreshRows: function() {
      const table2 = this.table || this._findTable();
      if (!table2) {
        this.rows = [];
        this.selectedIndex = -1;
        return;
      }
      const body = table2.tBodies && table2.tBodies.length ? table2.tBodies[0] : table2.querySelector("tbody");
      const rows = body ? body.rows : table2.rows;
      this.rows = Array.prototype.slice.call(rows || []);
      if (this.selectedIndex >= this.rows.length) {
        this.selectedIndex = -1;
      }
    },
    _setSelectedIndex: function(index) {
      const rows = this.rows || [];
      if (!rows.length) {
        this.selectedIndex = -1;
        return;
      }
      if (typeof index !== "number" || index < 0 || index >= rows.length) {
        index = -1;
      }
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || !row.classList)
          continue;
        if (i === index)
          row.classList.add("selected");
        else
          row.classList.remove("selected");
      }
      this.selectedIndex = index;
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          this._findTable();
          this._refreshRows();
        }
      }
    },
    {
      for: "dom:click:*",
      on: {
        fn: function(ev) {
          const table2 = this.table || this._findTable();
          if (!table2)
            return;
          if (!ev || !ev.data || !ev.data.domEvent)
            return;
          const target = ev.data.domEvent.target;
          if (!target)
            return;
          let node = target;
          let clickedRow = null;
          while (node && node !== table2) {
            if (node.tagName && node.tagName.toLowerCase() === "tr") {
              clickedRow = node;
              break;
            }
            node = node.parentNode;
          }
          if (!clickedRow)
            return;
          this._refreshRows();
          const rows = this.rows || [];
          const index = rows.indexOf(clickedRow);
          if (index === -1)
            return;
          if (this.selectedIndex === index)
            this._setSelectedIndex(-1);
          else
            this._setSelectedIndex(index);
        }
      }
    }
  ],
  init: function() {
    this.brick.__tableExt = this;
    this.table = null;
    this.rows = [];
    this.selectedIndex = -1;
    return true;
  },
  destroy: function() {
    this.rows = [];
    this.table = null;
    this.selectedIndex = -1;
    if (this.brick) {
      delete this.brick.__tableExt;
    }
  }
};
var table_default = table;

// src/services/wire.js
var WireService = {
  kind: "wire"
};
var wire_default = WireService;

// src/_manifest.js
function registerBuiltins(VanillaBrick2) {
  if (html_css_default) {
    VanillaBrick2.extensions["htmlCss"] = html_css_default;
  }
  if (html_events_default) {
    VanillaBrick2.extensions["htmlEvents"] = html_events_default;
  }
  if (html_render_default) {
    VanillaBrick2.extensions["htmlRender"] = html_render_default;
  }
  if (html_default) {
    VanillaBrick2.extensions["html"] = html_default;
  }
  if (store_default) {
    VanillaBrick2.extensions["store"] = store_default;
  }
  if (wire_client_default) {
    VanillaBrick2.extensions["wire"] = wire_client_default;
  }
  if (wire_service_default) {
    VanillaBrick2.extensions["wireservice"] = wire_service_default;
  }
  if (form_items_default) {
    VanillaBrick2.extensions["formItems"] = form_items_default;
  }
  if (form_record_default) {
    VanillaBrick2.extensions["formRecord"] = form_record_default;
  }
  if (form_default) {
    VanillaBrick2.extensions["form"] = form_default;
  }
  if (status_bar_default) {
    VanillaBrick2.extensions["statusBar"] = status_bar_default;
  }
  if (table_columns_default) {
    VanillaBrick2.extensions["tableColumns"] = table_columns_default;
  }
  if (table_rows_focused_default) {
    VanillaBrick2.extensions["tableRowsFocused"] = table_rows_focused_default;
  }
  if (table_rows_default) {
    VanillaBrick2.extensions["tableRows"] = table_rows_default;
  }
  if (table_default) {
    VanillaBrick2.extensions["table"] = table_default;
  }
  VanillaBrick2.services["WireService"] = wire_default;
}

// src/index.js
var runtimeCtrl = new RuntimeController();
var VanillaBrick = {
  brick: Brick,
  registry: extensionsRegistry_default,
  utils: options_exports,
  extensions: {},
  services: {},
  configs: {},
  runtime: runtimeCtrl,
  // Global execution motor
  base: {}
};
VanillaBrick.runtime.bricks = [];
VanillaBrick.runtime.services = {};
VanillaBrick.runtime.prototypes = {};
VanillaBrick.runtime.controllers = {
  status: new StatusController(),
  options: new OptionsController(),
  events: new EventBusController(),
  extensions: new ExtensionsController()
};
globalThis.VanillaBrick = VanillaBrick;
registerBuiltins(VanillaBrick);
setupServices(VanillaBrick);
setupBootstrap(VanillaBrick);
var src_default = VanillaBrick;
export {
  Brick,
  src_default as default
};
//# sourceMappingURL=vanillabrick.esm.js.map
