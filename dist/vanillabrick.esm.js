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
  opts.kind = (opts.kind || "unknown").toLowerCase();
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
    if (!this._bakedCache)
      this._bakedCache = {};
    const prototypes = {};
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const name = def.name || def.ext.ns;
      if (this._bakedCache[name]) {
        prototypes[name] = this._bakedCache[name];
        continue;
      }
      const protoExt = {
        _name: name,
        _def: def.ext
      };
      Object.defineProperties(protoExt, {
        "options": { get: function() {
          return this.brick ? this.brick.options : null;
        } },
        "events": { get: function() {
          return this.brick ? this.brick.events : null;
        } },
        "status": { get: function() {
          return this.brick ? this.brick.status : null;
        } },
        "ext": { get: function() {
          return this;
        } },
        "_ctx": { get: function() {
          return this;
        } }
      });
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
      this._bakedCache[name] = prototypes[name];
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
  const self = this;
  brick.status = {
    get: () => self.get(brick),
    set: (status, payload) => self.set(brick, status, payload),
    is: (status) => self.is(brick, status)
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
  const self = this;
  brick.options = {
    get: function(key, fallback) {
      return self.get(brick, key, fallback);
    },
    set: function(key, value) {
      self.setSync(brick, key, value);
      return brick;
    },
    setAsync: async function(key, value) {
      await self.setAsync(brick, key, value);
      return brick;
    },
    has: function(key) {
      return self.has(brick, key);
    },
    all: function() {
      return self.all(brick);
    },
    setSilent: function(key, value) {
      self.setSilent(brick, key, value);
      return brick;
    }
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
  if (parts.length < 3) {
    console.error('[EventBus] Invalid event name format. Expected "namespace:type:target". Got:', eventName);
    return false;
  }
  const target = parts.slice(2).join(":");
  if (!parts[0] || parts[0] === "*" || !parts[1] || parts[1] === "*" || !target || target === "*") {
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
EventBusController.prototype.fire = async function(brick, eventName, payload) {
  await this._run(brick, eventName, payload);
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
  } else {
    ctxExt = {
      brick,
      name,
      def: def.ext
    };
  }
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
          brick.events.on(pattern, phase, pr, { fn: desc.fn, ctx: ctxExt, meta });
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
        console.warn("VanillaBrick: invalid JSON in data-brick config", err, node);
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
    const elId = el.getAttribute && el.getAttribute("id");
    const config = elId && VanillaBrick2.configs ? VanillaBrick2.configs[elId] : null;
    if (config && typeof config === "object") {
      Object.assign(opts, config);
    }
    if (elId) {
      opts.id = elId;
    }
    const kind = readKind(el);
    if (kind) {
      opts.kind = kind;
    }
    opts.html = {
      id: elId || null,
      element: el
    };
    const brick = new VanillaBrick2.brick(opts);
    el.__brickInstance = brick;
    registry.list.push(brick);
    registry.byId[brick.id] = brick;
    console.log("Brick", elId, brick);
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
    off: function(el, type, handler) {
      if (!el || typeof el.removeEventListener !== "function")
        return;
      const listeners = this.brick.options.get("html.listeners", []);
      if (!Array.isArray(listeners) || listeners.length === 0)
        return;
      const hasType = typeof type === "string" && type.length > 0;
      const hasHandler = typeof handler === "function";
      for (let i = listeners.length - 1; i >= 0; i--) {
        const ln = listeners[i];
        if (!ln || ln.el !== el)
          continue;
        if (hasType && ln.type !== type)
          continue;
        if (hasHandler && ln.handler !== handler)
          continue;
        el.removeEventListener(ln.type, ln.handler, ln.options);
        listeners.splice(i, 1);
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
    attr: function(el, key, value) {
      if (!el)
        return el;
      if (key && typeof key === "object") {
        for (const k in key)
          attr(el, k, key[k]);
        return el;
      }
      if (value === void 0 || value === null || value === false) {
        el.removeAttribute(key);
        return el;
      }
      if (value === true) {
        el.setAttribute(key, "");
        return el;
      }
      el.setAttribute(key, String(value));
      return el;
    },
    // Safe getters/creators
    get: function(selectorOrTag, root) {
      if (!selectorOrTag)
        return null;
      if (root == null) {
        root = this.html && typeof this.html.element === "function" ? this.html.element() : null;
      }
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
    detach: function(el) {
      if (!el)
        return el || null;
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
      return el;
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

// src/extensions/store-local.js
var storeLocal = {
  for: [{ host: "brick", kind: "*" }],
  requires: ["store"],
  ns: "store",
  options: {},
  /**
   * No additional public API - uses store.js API
   */
  brick: {},
  extension: {
    _masterData: null,
    _isEnabled: function() {
      const type = this.brick.options.get("store.type", "local");
      return type === "local" || type === "" || type === null || type === void 0;
    },
    /**
     * Cache initial data from options
     */
    _initMasterData: function() {
      if (this._masterData)
        return;
      const initial = this.brick.options.get("store.data", []);
      this._masterData = Array.isArray(initial) ? initial.slice() : [];
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        priority: 1,
        // High priority to grab data before store.load clears it
        fn: function() {
          if (!this._isEnabled())
            return;
          this._initMasterData();
        }
      }
    },
    {
      for: "store:data:load",
      on: {
        priority: 5,
        fn: function(ev) {
          if (!this._isEnabled())
            return;
          const data = this._masterData || [];
          this.brick.store.set(data);
          this.brick.options.setSilent("store.totalCount", data.length);
          ev.data = { data, source: "local", count: data.length };
        }
      }
    },
    {
      // Handle ensure requests (trivial for local, but needed for consistency)
      for: "store:data:ensure",
      on: {
        fn: function(ev) {
          if (!this._isEnabled())
            return;
          if (!this._masterData)
            return;
          const start = ev.data.start || 0;
          const count = ev.data.count || 1;
          const slice = this._masterData.slice(start, start + count);
          this.brick.store.set(slice, start);
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var store_local_default = storeLocal;

// src/extensions/store-remote.js
var storeRemote = {
  for: [{ host: "brick", kind: "*" }],
  requires: ["store"],
  ns: "store",
  options: {},
  /**
   * No additional public API - uses store.js API
   */
  brick: {},
  /**
   * Private extension helpers
   */
  extension: {
    /**
     * Check if this strategy should handle the request
     * @returns {boolean}
     */
    _isEnabled: function() {
      const type = this.brick.options.get("store.type", "");
      return type === "remote";
    },
    /**
     * Fetch data from remote URL
     * @param {Object} query - Query parameters
     * @param {string} query.url - URL to fetch from
     * @returns {Promise<Array>}
     */
    _fetchData: async function(query) {
      if (!query || !query.url) {
        console.warn("[store-remote] No URL configured for remote store");
        return [];
      }
      const config = this.brick.options.get("store.pagination", {});
      const mode = config.mode || "client";
      const params = config.params || {};
      const keyOffset = params.offset || "offset";
      const keyLimit = params.limit || "limit";
      const urlObj = new URL(query.url, window.location.origin);
      if (mode === "server") {
        if (typeof query.start === "number")
          urlObj.searchParams.append(keyOffset, query.start);
        if (typeof query.count === "number")
          urlObj.searchParams.append(keyLimit, query.count);
      } else {
      }
      const res = await fetch(urlObj.toString());
      if (!res.ok) {
        throw new Error("[store-remote] HTTP " + res.status + " fetching " + urlObj.toString());
      }
      return await res.json();
    }
  },
  /**
   * Event handlers
   */
  events: [
    {
      for: "store:data:load",
      on: {
        priority: 5,
        fn: async function(ev) {
          if (!this._isEnabled())
            return;
          const config = this.brick.options.get("store", {});
          const pageSize = config.pagination && config.pagination.pageSize ? config.pagination.pageSize : config.pageSize || 50;
          const query = {
            url: config.url || null,
            start: 0,
            count: pageSize
          };
          try {
            const result = await this._fetchData(query);
            let items = [];
            let remoteTotal = null;
            if (Array.isArray(result)) {
              items = result;
            } else if (result && result.data && Array.isArray(result.data)) {
              items = result.data;
              if (typeof result.total === "number")
                remoteTotal = result.total;
              else if (typeof result.totalCount === "number")
                remoteTotal = result.totalCount;
              else if (typeof result.count === "number")
                remoteTotal = result.count;
            }
            let finalTotal = 0;
            const configuredDefault = this.brick.options.get("store.defaultTotalCount", 0);
            const currentTotal = this.brick.options.get("store.totalCount", 0);
            const isServerMode = this.brick.options.get("store.pagination.mode") === "server";
            if (remoteTotal !== null) {
              finalTotal = remoteTotal;
            } else if (!isServerMode) {
              finalTotal = items.length;
            } else {
              if (configuredDefault > 0) {
                finalTotal = configuredDefault;
              } else {
                finalTotal = Math.max(currentTotal, items.length);
              }
            }
            if (finalTotal > 0) {
              this.brick.options.setSilent("store.totalCount", finalTotal);
            }
            this.brick.store.set(items, query.start || 0);
            console.info(`[store-remote] Loaded ${items.length} items. Mode: ${isServerMode ? "Server" : "Client"}. Total set to: ${finalTotal}`);
            ev.data = { data: items, source: "remote", url: query.url };
          } catch (err) {
            console.error("[store-remote] Load failed:", err);
            ev.data = { data: [], source: "remote", error: err.message };
            ev.cancel = true;
          }
        }
      }
    },
    {
      for: "store:data:ensure",
      on: {
        fn: async function(ev) {
          if (!this._isEnabled())
            return;
          const config = this.brick.options.get("store", {});
          const start = ev.data.start || 0;
          const count = ev.data.count || 50;
          const query = {
            url: config.url,
            start,
            count
          };
          try {
            const result = await this._fetchData(query);
            let items = [];
            if (Array.isArray(result)) {
              items = result;
            } else if (result && result.data && Array.isArray(result.data)) {
              items = result.data;
              const total = result.total || result.totalCount || result.count;
              if (total && total !== this.brick.store.count()) {
                this.brick.options.setSilent("store.totalCount", total);
              }
            }
            this.brick.store.set(items, start);
          } catch (err) {
            console.error("[store-remote] Range load failed:", err);
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
var store_remote_default = storeRemote;

// src/extensions/store-sort.js
var storeSort = {
  for: [{ host: "brick", kind: "*" }],
  requires: ["store"],
  ns: "storeSort",
  // Namespace to avoid collision (optional, usually extensions don't need ns unless exposing API)
  // No public API exposed on brick directly, works via events
  brick: {},
  extension: {
    _canSortLocally: function() {
      const type = this.brick.options.get("store.type", "local");
      const mode = this.brick.options.get("store.pagination.mode", "client");
      if (type === "local" || type === "memory")
        return true;
      if (type === "remote" && mode === "client")
        return true;
      return false;
    }
  },
  events: [
    {
      for: "store:data:sort",
      on: {
        fn: function(ev) {
          if (!this._canSortLocally())
            return;
          const field = ev.data.field;
          const dir = ev.data.dir || "asc";
          console.info(`[store-sort] Sorting locally by ${field} (${dir})`);
          const data = this.brick.store.data() || [];
          const compareFn = ev.compare || function(a, b) {
            if (a === void 0 || a === null)
              return 1;
            if (b === void 0 || b === null)
              return -1;
            const va = a[field];
            const vb = b[field];
            if (typeof va === "string" && typeof vb === "string") {
              return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            if (va < vb)
              return dir === "asc" ? -1 : 1;
            if (va > vb)
              return dir === "asc" ? 1 : -1;
            return 0;
          };
          data.sort(compareFn);
          this.brick.store.set(data);
          this.brick.events.fire("store:data:updated", { source: "sort", field, dir });
          this.brick.events.fire("table:rows:render");
        }
      }
    }
  ],
  init: function() {
  },
  destroy: function() {
  }
};
var store_sort_default = storeSort;

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
  { code: "10", name: "ten", key: 10 }
];
var store = {
  for: [{ host: "brick", kind: "*" }],
  requires: [],
  ns: "store",
  options: {
    store: {
      type: "local",
      // 'local' | 'remote'
      uidField: "key",
      data: []
    }
  },
  /**
   * Public Brick API (this = extension context with this.brick)
   */
  brick: {
    /**
     * Get the configured UID field name
     * @returns {string}
     */
    uidField: function() {
      return this.brick.options.get("store.uidField", "key");
    },
    /**
     * Get current store data array (Sparse Array)
     * @returns {Array}
     */
    data: function() {
      return this.brick.options.get("store.data", []);
    },
    /**
     * Get current store type
     * @returns {string} 'memory' | 'local' | 'remote'
     */
    type: function() {
      return this.brick.options.get("store.type", "memory");
    },
    /**
     * Ensure a specific range of data is loaded.
     * Fires 'store:data:ensure' if gaps are found.
     * @param {number} start - Start index
     * @param {number} count - Number of items
     * @returns {Promise}
     */
    ensureRange: async function(start, count) {
      const data = this.brick.options.get("store.data", []);
      const total = this.brick.options.get("store.totalCount", 0);
      if (total > 0 && start >= total)
        return;
      const effectiveCount = total > 0 ? Math.min(count, total - start) : count;
      let hasGap = false;
      for (let i = start; i < start + effectiveCount; i++) {
        if (!data[i]) {
          hasGap = true;
          break;
        }
      }
      if (hasGap) {
        await this.brick.events.fireAsync("store:data:ensure", { start, count: effectiveCount });
      }
    },
    /**
     * Trigger full data load/reset
     * @returns {Promise}
     */
    load: async function() {
      this.brick.options.setSilent("store.data", []);
      const defaultTotal = this.brick.options.get("store.defaultTotalCount", 0);
      this.brick.options.setSilent("store.totalCount", defaultTotal);
      return this.brick.events.fireAsync("store:data:load", {});
    },
    /**
     * Set store data directly (updates specific range or full replace)
     * @param {Array} rows - New data rowsv
     * @param {number} [start=0] - Starting index (if partial update)
     * @returns {Object} brick
     */
    set: function(rows, start) {
      if (!rows)
        return this.brick;
      const newRows = Array.isArray(rows) ? rows : [rows];
      const currentData = this.brick.options.get("store.data", []);
      const total = this.brick.options.get("store.totalCount", 0);
      let nextData;
      if (typeof start === "number") {
        nextData = currentData;
        for (let i = 0; i < newRows.length; i++) {
          nextData[start + i] = newRows[i];
        }
        if (nextData.length > total) {
          this.brick.options.setSilent("store.totalCount", nextData.length);
        }
      } else {
        nextData = newRows;
        this.brick.options.setSilent("store.totalCount", nextData.length);
      }
      this.brick.options.setSilent("store.data", nextData);
      this.brick.events.fire("store:data:updated", {
        data: nextData,
        start: start || 0,
        count: newRows.length
      });
      return this.brick;
    },
    /**
     * Get all records (careful with large sparse arrays)
     * @returns {Array}
     */
    all: function() {
      return this.brick.options.get("store.data", []);
    },
    /**
     * Get record by index
     * @param {number} index
     * @returns {Object|null}
     */
    get: function(index) {
      const arr = this.brick.options.get("store.data", []);
      return arr[index] || null;
    },
    /**
     * Get record by UID
     * @param {*} uid
     * @returns {Object|null}
     */
    find: function(uid) {
      const arr = this.brick.options.get("store.data", []);
      const field = this.brick.store.uidField();
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i][field] === uid)
          return arr[i];
      }
      return null;
    },
    /**
     * Get total record count
     * @returns {number}
     */
    count: function() {
      return this.brick.options.get("store.totalCount", 0);
    },
    /**
     * Trigger sort operation
     * @param {string} field
     * @param {string} dir
     * @param {Function} compareFn
     */
    sort: function(field, dir, compareFn) {
      this.brick.events.fire("store:data:sort", {
        field,
        dir: dir || "asc",
        compare: compareFn
      });
      return this.brick;
    }
  },
  /**
   * Private extension helpers (this = extension context)
   */
  extension: {
    /**
     * Normalize value to array
     * @param {*} value
     * @param {Array} fallback
     * @returns {Array}
     */
    _normalizeArray: function(value, fallback) {
      if (Array.isArray(value))
        return value.slice();
      return Array.isArray(fallback) ? fallback.slice() : [];
    },
    /**
     * Sort rows by field
     * @param {Array} rows
     * @param {string} field
     * @param {string} dir - 'asc' or 'desc'
     * @param {Function} compareFn - Optional custom compare
     * @returns {Array} sorted copy
     */
    _sortRows: function(rows, field, dir, compareFn) {
      const arr = Array.isArray(rows) ? rows.slice() : [];
      const direction = dir === "desc" ? -1 : 1;
      const cmp = typeof compareFn === "function" ? function(a, b) {
        return compareFn(a, b, dir);
      } : function(a, b) {
        const va = a && Object.prototype.hasOwnProperty.call(a, field) ? a[field] : void 0;
        const vb = b && Object.prototype.hasOwnProperty.call(b, field) ? b[field] : void 0;
        if (va === vb)
          return 0;
        if (va === void 0 || va === null)
          return -1 * direction;
        if (vb === void 0 || vb === null)
          return 1 * direction;
        if (typeof va === "number" && typeof vb === "number")
          return (va - vb) * direction;
        return String(va).localeCompare(String(vb)) * direction;
      };
      arr.sort(cmp);
      return arr;
    }
  },
  /**
   * Event handlers
   */
  events: [
    // On brick ready, trigger store load
    {
      for: "brick:status:ready",
      on: {
        priority: 5,
        fn: function() {
          const storeType = this.brick.options.get("store.type", "local");
          const existingData = this.brick.options.get("store.data", null);
          if (storeType === "local" && (!existingData || existingData.length === 0)) {
            const sampleData = this._normalizeArray(DATA_SAMPLE_ROWS, []);
            this.brick.options.setSilent("store.data", sampleData);
          }
          this.brick.store.load();
        }
      }
    },
    // Handle store:data:set - persist data to options
    {
      for: "store:data:set",
      on: {
        priority: 5,
        fn: function(ev) {
          const payload = ev && ev.data || {};
          const data = payload.data || [];
          this.brick.options.setSilent("store.data", data);
          ev.data = { data, previous: payload.previous };
        }
      }
    },
    // Handle store:data:sort
    {
      for: "store:data:sort",
      on: {
        priority: 5,
        fn: function(ev) {
          const payload = ev && ev.data || {};
          const field = payload.field;
          const dir = payload.dir || "asc";
          if (!field)
            return;
          const currentData = this.brick.options.get("store.data", []);
          const sorted = this._sortRows(currentData, field, dir, payload.compare);
          this.brick.options.setSilent("store.data", sorted);
          ev.data = { data: sorted, field, dir };
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
      if (!this.ext._service)
        this.ext._connect();
      if (!this.ext._service)
        return;
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
  brick: {
    phase: async function(phase, eventName, ev) {
      await this.brick._controllers.events._firePhase(
        this.brick,
        phase,
        eventName,
        ev
      );
    }
  },
  events: [
    {
      for: "wire:notify:out",
      on: {
        fn: function(ev) {
          const master = ev.data.from;
          const evName = ev.data.event;
          const evData = ev.data.data;
          const slaves = this.ext._slaves[master];
          if (slaves && slaves.length > 0) {
            for (let i = 0; i < slaves.length; i++) {
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
      const html2 = this.brick.html;
      const root = html2.element();
      if (!root)
        return;
      html2.clear(root);
      const frag = html2.frag() || root.ownerDocument.createDocumentFragment();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type !== "group")
          continue;
        const groupEl = html2.create("div", { classList: ["vb-form-group"] });
        const rowEl = html2.create("div", { classList: ["vb-row"] });
        if (item.items && item.items.length) {
          for (let j = 0; j < item.items.length; j++) {
            const field = item.items[j];
            const span = field.span || 12;
            const colEl = html2.create("div", { classList: ["vb-span-" + span] });
            const fieldContainer = html2.create("div", { classList: ["vb-form-field"] });
            if (field.label) {
              const label = html2.create("label", { text: field.label });
              if (field.name)
                label.htmlFor = field.name;
              html2.append(fieldContainer, label);
            }
            let input;
            if (field.controlType === "textarea") {
              input = html2.create("textarea");
            } else if (field.controlType === "select") {
              input = html2.create("select");
            } else {
              input = html2.create("input");
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
            html2.append(fieldContainer, input);
            html2.append(colEl, fieldContainer);
            html2.append(rowEl, colEl);
          }
        }
        html2.append(groupEl, rowEl);
        html2.append(frag, groupEl);
      }
      html2.append(root, frag);
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
      const data = this.brick.store.data();
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
        }
      }
    },
    {
      for: "store:data:*",
      after: {
        fn: function(ev) {
          const data = ev.data;
          const record = data && data.length ? data[0] : null;
          this._bind(record);
        }
      }
    },
    {
      for: "dom:row:focus",
      after: {
        fn: function(ev) {
          const record = ev.data.row;
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
      const el = this.brick.html.element();
      if (el && typeof el.submit === "function")
        el.submit();
    },
    reset: function() {
      const el = this.brick.html.element();
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
          const uidField = ev.data.uidField;
          const el = this.brick.html.element();
          if (el) {
            el.textContent = `Wire OK -> Selected: ${record[uidField]}`;
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
      if (!field)
        return;
      const cols = this.brick.columns.get();
      const colDef = cols.find(function(c) {
        return c && c.datafield === field;
      }) || {};
      const state = this.brick.options.get("table.sort", { field: null, dir: null });
      let nextDir = dir;
      if (nextDir !== "asc" && nextDir !== "desc") {
        nextDir = state.field === field && state.dir === "asc" ? "desc" : "asc";
      }
      console.info(`[table-columns] Sorting field: ${field}, nextDir: ${nextDir}`);
      this.brick.events.fire("store:data:sort", {
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
        fn: function(ev) {
          const columns = this.brick.columns.get();
          const html2 = this.brick.html;
          const root = html2.element && html2.element();
          if (!root)
            return;
          const table2 = root.tagName && root.tagName.toLowerCase() === "table" ? root : html2.get && html2.get("table") || root.querySelector && root.querySelector("table");
          if (!table2)
            return;
          const thead = html2.create("thead");
          const row = thead.insertRow();
          const brick = this.brick;
          for (let i = 0; i < columns.length; i += 1) {
            const col = columns[i] || {};
            const th = html2.create("th", { text: col.label || col.datafield || "" });
            html2.attr(th, "data-field", col.datafield);
            if (col.sortable && col.datafield) {
              th.classList.add("vb-sortable");
              html2.on(th, "click", /* @__PURE__ */ function(colDef) {
                return function() {
                  brick.columns.sort(colDef.datafield, null);
                };
              }(col));
            }
            html2.append(row, th);
          }
          if (!ev.data)
            ev.data = {};
          ev.data.table = table2;
          ev.data.thead = thead;
        }
      },
      after: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const table2 = ev && ev.data && ev.data.table || html2.get && html2.get("table") || null;
          const thead = ev && ev.data && ev.data.thead;
          if (!table2 || !thead)
            return;
          const existing = table2.tHead || table2.querySelector && table2.querySelector("thead");
          if (existing && existing !== thead && existing.parentNode === table2) {
            table2.removeChild(existing);
          }
          table2.insertBefore(thead, table2.firstChild || null);
        }
      }
    },
    {
      for: "store:data:sort",
      after: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const field = ev.data.field;
          const dir = ev.data.dir || "asc";
          this.brick.options.set("table.sort", { field, dir });
          const root = html2.element();
          if (!root)
            return;
          const ths = root.querySelectorAll("th.vb-sortable");
          ths.forEach((th) => {
            th.classList.remove("vb-sort-asc", "vb-sort-desc");
            if (html2.attr(th, "data-field") === field) {
              th.classList.add(dir === "desc" ? "vb-sort-desc" : "vb-sort-asc");
            }
          });
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
        { datafield: "userId", label: "userid", sortable: true },
        { datafield: "title", label: "title", sortable: true },
        { datafield: "id", label: "id", sortable: false, isKey: true }
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
    /* _addTabIndex: function () {
         const el = this.brick.html.element();
         if (!el) return;
         const rows = el.querySelectorAll('tbody tr') || [];
         for (let i = 0; i < rows.length; i++) {
             const row = rows[i];
             if (!row.hasAttribute('tabindex')) {
                 row.setAttribute('tabindex', i);
             }
         }
     },
     _handleFocus: function (target) {
         const el = this.brick.html.element();
         if (!el) return;
         const row = target.closest('tr');
         if (!row) return;
         const old = el.querySelector('tr.vb-focused');
         if (old) old.classList.remove('vb-focused');
         row.classList.add('vb-focused');
         const rowIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
         const data = this.brick.store.get(rowIndex);
         this.brick.events.fire('dom:row:focus', {
             index: rowIndex,
             row: data,
             element: row
         });
     }*/
  },
  events: [
    {
      // Per-row render
      for: "table:row:render",
      before: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const tr = ev.data.tr;
          if (tr == null)
            return;
          html2.off(tr, "mousedown");
        }
      },
      after: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const tr = ev.data.tr;
          const rowData = ev.data.row;
          const uidField = this.brick.store.uidField();
          const focusedId = this.brick.options.get("table.focusedId");
          if (focusedId !== void 0 && rowData[uidField] === focusedId) {
            this.brick.css.addClass(tr, "vb-focused");
          }
          html2.on(tr, "mousedown", (e) => {
            var _a;
            const root = this.brick.html.element();
            root.querySelectorAll("tr.vb-focused").forEach((el) => {
              if (el !== tr)
                this.brick.css.removeClass(el, "vb-focused");
            });
            this.brick.css.addClass(tr, "vb-focused");
            this.brick.options.set("table.focusedId", rowData[uidField]);
            (_a = this.brick.wire) == null ? void 0 : _a.notify("dom:row:focus", { row: rowData, uidField });
          });
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
    render: function(ev) {
      if (ev == null || ev.data == null)
        return;
      const html2 = this.brick.html;
      const root = html2.element();
      if (!root)
        return;
      const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      const rows = ev.data;
      const columns = this.brick.columns.get();
      this.brick.events.fire("table:rows:render", { rows, columns });
    }
  },
  extension: {},
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function(ev) {
        }
      }
    },
    {
      for: "store:data:*",
      after: {
        priority: 5,
        // After virtual (priority 3)
        fn: function(ev) {
          if (ev.virtualHandled)
            return;
          this.brick.rows.render(ev);
        }
      }
    },
    {
      for: "table:rows:render",
      before: {
        priority: 10,
        // Low priority: Run AFTER extensions (like virtual scroll) have had a chance
        fn: function(ev) {
          const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          const html2 = this.brick.html;
          const items = this.brick.options.get("table.rows") || {};
          const rows = Array.isArray(ev.data.rows) ? ev.data.rows : this.brick.store.data();
          const columns = Array.isArray(ev.data.columns) ? ev.data.columns : this.brick.columns.get();
          const uidField = this.brick.store.uidField();
          for (let i = 0; i < rows.length; i++) {
            let item = items[rows[i][uidField]];
            if (item == null) {
              item = {};
              items[rows[i][uidField]] = item;
            }
            item.row = rows[i];
            let tr = item.tr || null;
            if (tr == null) {
              tr = html2.create("tr");
              html2.attr(tr, "for", item.row[uidField]);
              items[item.row[uidField]].tr = tr;
            }
            for (let c = 0; c < columns.length; c++) {
              let td = tr.children.length > 0 ? tr.children[c] : null;
              if (td == null) {
                td = html2.create("td");
                html2.append(tr, td);
              }
              html2.attr(td, "for", columns[c].datafield);
              html2.setSafe(td, item.row[columns[c].datafield]);
            }
          }
          this.brick.options.setSilent("table.rows", items);
          const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          const ms = Math.round(t1 - t0);
          console.warn("data created in...", ms, "ms", "total items:", Object.keys(items).length);
        }
      }
    },
    {
      // Manage full rows render pipeline
      for: "table:rows:render",
      before: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const root = html2.element && html2.element();
          const items = this.brick.options.get("table.rows");
          const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          if (!root)
            return;
          ev.data = ev.data || {};
          ev.data.t0 = t0;
          ev.data.items = items;
          ev.data.columns = Array.isArray(ev.data.columns) ? ev.data.columns : this.brick.columns.get();
          const table2 = root.tagName && root.tagName.toLowerCase() === "table" ? root : html2.get && html2.get("table") || root.querySelector && root.querySelector("table");
          if (!table2)
            return;
          if (this.brick.options.get("table.virtual.enabled")) {
            ev.virtualHandled = true;
            ev.cancel = true;
            return;
          }
          const tbody = html2.detach(table2.querySelector("tbody"));
          if (tbody) {
            for (let i = tbody.children.length - 1; i >= 0; i--) {
              html2.detach(tbody.children[i]);
            }
          } else {
            const newTbody = html2.create("tbody");
            html2.append(table2, newTbody);
            ev.data.table = table2;
            ev.data.tbody = newTbody;
            return;
          }
          ev.data.table = table2;
          ev.data.tbody = tbody;
        }
      },
      on: {
        fn: function(ev) {
          const data = ev.data || {};
          const rows = Array.isArray(ev && ev.data && ev.data.rows) ? ev.data.rows : this.brick.store.data();
          const columns = Array.isArray(ev && ev.data && ev.data.columns) ? ev.data.columns : this.brick.columns.get();
          data.columns = columns;
          data.rows = rows;
          const uidField = this.brick.store.uidField();
          for (let i = 0; i < rows.length; i += 1) {
            const item = ev.data.items[rows[i][uidField]];
            const rowData = rows[i] || {};
            this.brick.events.fire("table:row:render", {
              item,
              row: rowData,
              rowIndex: i,
              tbody: ev.data.tbody,
              columns
            });
          }
        }
      },
      after: {
        fn: function(ev) {
          const data = ev.data || {};
          const html2 = this.brick.html;
          const tbody = data.tbody;
          if (!tbody)
            return;
          requestAnimationFrame(() => {
            html2.append(data.table, tbody);
          });
          const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
          const ms = Math.round(t1 - ev.data.t0);
          console.warn("table rows pipeline time", ms, "ms");
        }
      }
    },
    {
      // Per-row render
      for: "table:row:render",
      before: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const tr = ev.data.item.tr;
          ev.data.tr = tr;
        }
      },
      on: {
        fn: function(ev) {
        }
      },
      after: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const tr = ev.data.tr;
          const tbody = ev.data.tbody;
          if (tbody && tr) {
            html2.append(tbody, tr);
          }
        }
      }
    },
    {
      // Per-column render
      for: "table:col:render",
      before: {
        fn: function(ev) {
          const html2 = this.brick.html;
          const tr = ev.data.tr;
          const column = ev.data.column;
          const row = ev.data.row;
          if (!tr)
            return;
          let td = html2.get('[for="' + column.datafield + '"]', tr);
          if (!td) {
            td = html2.create("td");
            html2.attr(td, "for", column.datafield);
            html2.append(tr, td);
          }
          html2.setSafe(td, row[column.datafield]);
          ev.data.td = td;
        }
      },
      on: {
        fn: function(ev) {
          const td = ev.data.td;
          const col = ev.data.column || {};
          const row = ev.data.row || {};
          const field = col.datafield;
          const val = field && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : "";
          if (td) {
            td.textContent = val === void 0 || val === null ? "" : val;
          }
        }
      },
      after: {
        fn: function() {
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

// src/components/table-virtual.js
var tableVirtual = {
  for: [{ host: "brick", kind: "table" }],
  requires: ["html", "store", "columns"],
  ns: "virtual",
  options: {
    table: {
      virtual: {
        enabled: false,
        pageSize: 25,
        maxHeight: 400,
        rowHeight: 33
      }
    }
  },
  brick: {
    isEnabled: function() {
      return this.brick.options.get("table.virtual.enabled", false) === true;
    },
    refresh: function() {
      this._renderVisibleWindow();
    }
  },
  extension: {
    _wrapper: null,
    _table: null,
    _tbody: null,
    _spacerTop: null,
    _spacerBottom: null,
    _currentPage: -1,
    _rowHeight: 33,
    _ticking: false,
    _isEnabled: function() {
      return this.brick.options.get("table.virtual.enabled", false) === true;
    },
    _initStructure: function() {
      const html2 = this.brick.html;
      const root = html2.element();
      if (!root)
        return false;
      this._table = root.tagName && root.tagName.toLowerCase() === "table" ? root : root.querySelector("table");
      if (!this._table)
        return false;
      this._table.style.position = "";
      this._table.style.top = "";
      this._table.style.transform = "";
      this._table.style.width = "100%";
      this._table.style.borderCollapse = "collapse";
      const parent = this._table.parentNode;
      if (parent && parent.classList && parent.classList.contains("vb-table-wrapper")) {
        this._wrapper = parent;
      } else {
        this._wrapper = html2.create("div", { classList: ["vb-table-wrapper", "vb-virtual"] });
        parent.insertBefore(this._wrapper, this._table);
        this._wrapper.appendChild(this._table);
      }
      this._wrapper.style.maxHeight = this.brick.options.get("table.virtual.maxHeight", 400) + "px";
      this._wrapper.style.overflowY = "auto";
      this._wrapper.style.position = "relative";
      const canvas = this._wrapper.querySelector(".vb-virtual-canvas");
      if (canvas)
        html2.detach(canvas);
      const headerTable = this._wrapper.querySelector(".vb-virtual-header-table");
      if (headerTable) {
        const thead = headerTable.querySelector("thead");
        if (thead)
          this._table.insertBefore(thead, this._table.firstChild);
        html2.detach(headerTable);
      }
      let tbody = this._table.querySelector("tbody");
      if (!tbody) {
        tbody = html2.create("tbody");
        this._table.appendChild(tbody);
      }
      const tbodies = this._table.querySelectorAll("tbody");
      if (tbodies.length > 1) {
        for (let i = 1; i < tbodies.length; i++)
          html2.detach(tbodies[i]);
        tbody = tbodies[0];
      }
      this._tbody = tbody;
      const ths = this._table.querySelectorAll("th");
      ths.forEach((th) => {
        th.style.position = "sticky";
        th.style.top = "0";
        th.style.zIndex = "2";
        if (!th.style.backgroundColor)
          th.style.backgroundColor = "#f8f9fa";
      });
      return true;
    },
    _updateCanvas: function() {
      this._renderVisibleWindow();
    },
    _renderVisibleWindow: function() {
      const scrollTop = this._wrapper.scrollTop;
      const pageSize = this.brick.options.get("table.virtual.pageSize", 50);
      this._rowHeight = this.brick.options.get("table.virtual.rowHeight", 33);
      const totalCount = this.brick.store.count() || 0;
      const startRowComplete = Math.floor(scrollTop / this._rowHeight);
      let startRow = Math.max(0, startRowComplete - pageSize / 2);
      startRow = Math.floor(startRow / pageSize) * pageSize;
      const windowSize = pageSize;
      const index = Math.floor(scrollTop / this._rowHeight);
      let renderStart = Math.floor(index / (windowSize / 2)) * (windowSize / 2);
      const pageNum = Math.floor(scrollTop / (pageSize * this._rowHeight));
      const maxPage = Math.ceil(totalCount / pageSize) - 1;
      const targetPage = Math.min(maxPage, Math.max(0, pageNum));
      const renderPageStart = Math.max(0, targetPage - 1);
      const renderPageEnd = Math.min(maxPage, targetPage + 1);
      const startIndex = renderPageStart * pageSize;
      let endIndex = (renderPageEnd + 1) * pageSize;
      if (endIndex > totalCount)
        endIndex = totalCount;
      this._renderRows(startIndex, endIndex, totalCount);
    },
    _renderRows: function(startIndex, endIndex, totalCount) {
      const html2 = this.brick.html;
      const itemMap = this.brick.options.get("table.rows") || {};
      const emptyData = this.brick.store.data() || [];
      const columns = this.brick.columns.get() || [];
      const uidField = this.brick.store.uidField();
      const topHeight = startIndex * this._rowHeight;
      const bottomHeight = (totalCount - endIndex) * this._rowHeight;
      html2.clear(this._tbody);
      if (topHeight > 0) {
        const tr = html2.create("tr", { classList: ["vb-virtual-spacer", "top"] });
        tr.style.height = topHeight + "px";
        tr.innerHTML = `<td colspan="100" style="padding:0; border:0; height:${topHeight}px;"></td>`;
        html2.append(this._tbody, tr);
      }
      for (let i = startIndex; i < endIndex; i++) {
        const rowData = emptyData[i];
        if (!rowData) {
          this._renderSkeletonRow(i);
          continue;
        }
        let item = itemMap[rowData[uidField]];
        if (!item) {
          item = { row: rowData };
          itemMap[rowData[uidField]] = item;
        }
        const tr = html2.create("tr");
        html2.attr(tr, "for", rowData[uidField]);
        html2.attr(tr, "data-index", i);
        if (window.getComputedStyle)
          tr.style.height = this._rowHeight + "px";
        for (let c = 0; c < columns.length; c++) {
          const col = columns[c];
          const td = html2.create("td");
          html2.attr(td, "for", col.datafield);
          const val = rowData[col.datafield];
          td.textContent = val === void 0 || val === null ? "" : val;
          html2.append(tr, td);
        }
        const eventData = {
          item: { tr },
          // For table-rows.js
          tr,
          // For table-rows-focused.js
          row: rowData,
          index: i,
          columns
        };
        this.brick.events.fire("table:row:render", eventData);
        html2.append(this._tbody, tr);
      }
      if (bottomHeight > 0) {
        const tr = html2.create("tr", { classList: ["vb-virtual-spacer", "bottom"] });
        tr.style.height = bottomHeight + "px";
        tr.innerHTML = `<td colspan="100" style="padding:0; border:0; height:${bottomHeight}px;"></td>`;
        html2.append(this._tbody, tr);
      }
      this.brick.options.setSilent("table.rows", itemMap);
    },
    _renderSkeletonRow: function(index) {
      const html2 = this.brick.html;
      const tr = html2.create("tr", { classList: ["vb-virtual-skeleton"] });
      tr.style.height = this._rowHeight + "px";
      html2.attr(tr, "data-index", index);
      const td = html2.create("td");
      td.colSpan = 100;
      td.innerHTML = `<div class="vb-skeleton-bar" style="height: 100%; width: 100%; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: vb-skeleton-loading 1.5s infinite;"></div>`;
      html2.append(tr, td);
      html2.append(this._tbody, tr);
    }
  },
  events: [
    {
      for: "brick:status:ready",
      on: {
        fn: function() {
          if (this._isEnabled()) {
            this._initStructure();
            this._wrapper.addEventListener("scroll", () => {
              if (!this._ticking) {
                window.requestAnimationFrame(() => {
                  this._renderVisibleWindow();
                  this._ticking = false;
                });
                this._ticking = true;
              }
            }, { passive: true });
          }
        }
      }
    },
    // Hook into data updates to refresh the window
    {
      for: "store:data:load",
      after: {
        fn: function() {
          if (this._isEnabled())
            this._renderVisibleWindow();
        }
      }
    },
    {
      for: "store:data:updated",
      after: {
        fn: function() {
          if (this._isEnabled())
            this._renderVisibleWindow();
        }
      }
    },
    // Intercept standard render requests (e.g. from Sort or Filter)
    {
      for: "table:rows:render",
      before: {
        priority: 5,
        // High priority (runs before table-rows at 10), but leaves room for critical hooks (0-4)
        fn: function(ev) {
          if (this._isEnabled()) {
            this._renderVisibleWindow();
            ev.virtualHandled = true;
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
var table_virtual_default = tableVirtual;

// src/components/table.js
var table = {
  for: [{ host: "brick", kind: "table" }],
  requires: ["html"],
  ns: "table",
  options: {},
  /**
   * Public Brick API
   */
  brick: {
    /**
     * Refresh the internal rows cache from DOM
     */
    refresh: function() {
      this._refreshRows();
    },
    /**
     * Get current selection state
     * @returns {{ index: number, row: HTMLElement|null }}
     */
    getSelection: function() {
      const idx = typeof this._selectedIndex === "number" ? this._selectedIndex : -1;
      const rows = this._rows || [];
      const row = idx >= 0 && rows[idx] ? rows[idx] : null;
      return { index: idx, row };
    },
    /**
     * Clear current selection
     */
    clearSelection: function() {
      this._setSelectedIndex(-1);
    }
  },
  /**
   * Private extension methods (accessible via this._methodName from brick API)
   */
  extension: {
    // State
    _table: null,
    _rows: [],
    _selectedIndex: -1,
    /**
     * Find and cache the table element
     * @returns {HTMLTableElement|null}
     */
    _findTable: function() {
      const root = this.brick.html && typeof this.brick.html.element === "function" ? this.brick.html.element() : null;
      if (!root || !root.querySelector) {
        this._table = null;
        return null;
      }
      const table2 = root.querySelector("table.vb-table") || root.querySelector("table");
      this._table = table2 || null;
      return this._table;
    },
    /**
     * Refresh the internal row array from DOM
     */
    _refreshRows: function() {
      const table2 = this._table || this._findTable();
      if (!table2) {
        this._rows = [];
        this._selectedIndex = -1;
        return;
      }
      const body = table2.tBodies && table2.tBodies.length ? table2.tBodies[0] : table2.querySelector("tbody");
      const rows = body ? body.rows : table2.rows;
      this._rows = Array.prototype.slice.call(rows || []);
      if (this._selectedIndex >= this._rows.length) {
        this._selectedIndex = -1;
      }
    },
    /**
     * Set the selected row index and update CSS classes
     * @param {number} index
     */
    _setSelectedIndex: function(index) {
      const rows = this._rows || [];
      if (!rows.length) {
        this._selectedIndex = -1;
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
      this._selectedIndex = index;
    }
  },
  /**
   * Event handlers
   */
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
          const table2 = this._table || this._findTable();
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
          const rows = this._rows || [];
          const index = rows.indexOf(clickedRow);
          if (index === -1)
            return;
          if (this._selectedIndex === index) {
            this._setSelectedIndex(-1);
          } else {
            this._setSelectedIndex(index);
          }
        }
      }
    }
  ],
  init: function() {
    this._table = null;
    this._rows = [];
    this._selectedIndex = -1;
    return true;
  },
  destroy: function() {
    this._rows = [];
    this._table = null;
    this._selectedIndex = -1;
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
  if (store_local_default) {
    VanillaBrick2.extensions["storeLocal"] = store_local_default;
  }
  if (store_remote_default) {
    VanillaBrick2.extensions["storeRemote"] = store_remote_default;
  }
  if (store_sort_default) {
    VanillaBrick2.extensions["storeSort"] = store_sort_default;
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
  if (table_virtual_default) {
    VanillaBrick2.extensions["tableVirtual"] = table_virtual_default;
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
