/**
 * Merges option objects with priority: last arguments override previous ones.
 * Handles nested objects (deep merge) but arrays are replaced.
 */
export function mergeOptions() {
  const result = {};

  for (let i = 0; i < arguments.length; i++) {
    const source = arguments[i];
    if (!source || typeof source !== 'object') continue;

    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

      const sVal = source[key];
      const rVal = result[key];

      if (
        sVal &&
        typeof sVal === 'object' &&
        !Array.isArray(sVal) &&
        rVal &&
        typeof rVal === 'object' &&
        !Array.isArray(rVal)
      ) {
        // Deep merge objects
        result[key] = mergeOptions(rVal, sVal);
      } else {
        // Replace primitives and arrays
        result[key] = sVal; // Shallow copy enough for config usually, or clone if needed
      }
    }
  }

  return result;
}

/**
 * Gets a value from an object using dot notation path (e.g. "table.columns.0.width")
 */
export function getOption(obj, path) {
  if (!obj || !path) return undefined;
  if (!path.indexOf('.')) return obj[path];

  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[parts[i]];
  }
  return current;
}

/**
 * Sets a value in an object using dot notation path, creating intermediate objects.
 */
export function setOption(obj, path, value) {
  if (!obj || !path) return;

  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (current[p] === undefined || current[p] === null) {
      current[p] = {};
    }
    current = current[p];
  }

  current[parts[parts.length - 1]] = value;
}
