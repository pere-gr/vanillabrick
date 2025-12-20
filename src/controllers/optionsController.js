import { mergeOptions, getOption, setOption } from '../utils/options.js';

/**
 * Options Controller (Global Singleton)
 * Manages configuration, defaults, and reactive updates for options.
 * @constructor
 */
export default function OptionsController() {
  // No per-brick state here.
}

/**
 * Initialize options for a brick
 * @param {Object} brick
 * @param {Object} initialOptions
 */
OptionsController.prototype.init = function (brick, initialOptions) {
  if (!brick || !brick._runtime) return;
  brick._runtime.options = {
    data: initialOptions || {},
    cache: {}
  };
};

/**
 * Get the full options object (resolved).
 */
OptionsController.prototype.all = function (brick) {
  return (brick && brick._runtime && brick._runtime.options) ? brick._runtime.options.data : {};
};

/**
 * Check if an option exists.
 */
OptionsController.prototype.has = function (brick, key) {
  const data = (brick && brick._runtime && brick._runtime.options) ? brick._runtime.options.data : {};
  const val = getOption(data, key);
  return val !== undefined;
};

/**
 * Get an option value with fallback.
 */
OptionsController.prototype.get = function (brick, key, fallback) {
  const state = (brick && brick._runtime) ? brick._runtime.options : null;
  if (!state) return fallback;

  // Check cache first (for simple keys or previously resolved deep keys)
  if (state.cache && Object.prototype.hasOwnProperty.call(state.cache, key)) {
    return state.cache[key];
  }

  const val = getOption(state.data, key);
  const result = (val === undefined) ? fallback : val;

  // Cache the result
  if (state.cache) {
    state.cache[key] = result;
  }
  return result;
};

/**
 * Set an option value synchronously.
 * Triggers 'option:changed' and specific 'option:changed:key'.
 */
OptionsController.prototype.setSync = function (brick, key, value) {
  const state = (brick && brick._runtime) ? brick._runtime.options : null;
  if (!state) return;

  const old = this.get(brick, key);
  if (old === value) return; // No change

  setOption(state.data, key, value);

  // Invalidate cache
  state.cache = {};

  // Fire change events
  if (brick.events) {
    brick.events.fire('brick:option:changed', { key: key, value: value, oldValue: old });
    brick.events.fire('brick:option:changed:' + key, { value: value, oldValue: old });
  }
};

/**
 * Set an option value silently (no events).
 */
OptionsController.prototype.setSilent = function (brick, key, value) {
  const state = (brick && brick._runtime) ? brick._runtime.options : null;
  if (!state) return;

  setOption(state.data, key, value);
  // Invalidate cache
  state.cache = {};
};

/**
 * Set an option value asynchronously (supports validation/middleware if expanded).
 */
OptionsController.prototype.setAsync = async function (brick, key, value) {
  this.setSync(brick, key, value);
  return Promise.resolve();
};
