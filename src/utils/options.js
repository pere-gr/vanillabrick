export function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isPollutionKey(key) {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

export function assertSafeValue(value, path) {
  // We allow everything now to avoid breaking DOM element references in options
  return { ok: true };
}

export function deepCloneOptions(value, path) {
  const currentPath = path || '';
  const valid = assertSafeValue(value, currentPath || '<root>');
  if (!valid.ok) {
    // unsupported value: keep reference
    return value;
  }

  if (Array.isArray(value)) {
    const arr = new Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      arr[i] = deepCloneOptions(value[i], currentPath ? currentPath + '[' + i + ']' : '[' + i + ']');
    }
    return arr;
  }

  if (isPlainObject(value)) {
    const obj = {};
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (isPollutionKey(key)) continue;
      const childPath = currentPath ? currentPath + '.' + key : key;
      obj[key] = deepCloneOptions(value[key], childPath);
    }
    return obj;
  }

  // primitive
  return value;
}

export function deepMergeOptions(dest) {
  if (!isPlainObject(dest)) {
    dest = {};
  }

  for (let si = 1; si < arguments.length; si += 1) {
    const src = arguments[si];
    if (src === null || typeof src === 'undefined') continue;
    if (!isPlainObject(src)) {
      const path = '<root>';
      return deepCloneOptions(src, path);
    }

    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      if (isPollutionKey(key)) continue;
      const val = src[key];
      const path = key;

      if (Array.isArray(val)) {
        dest[key] = deepCloneOptions(val, path);
        continue;
      }

      if (isPlainObject(val)) {
        if (!isPlainObject(dest[key])) {
          dest[key] = {};
        }
        deepMergeOptions(dest[key], val);
        continue;
      }

      const valid = assertSafeValue(val, path);
      dest[key] = val;
    }
  }

  return dest;
}

export function mergeOptions() {
  const args = Array.prototype.slice.call(arguments);
  args.unshift({});
  return deepMergeOptions.apply(null, args);
}
