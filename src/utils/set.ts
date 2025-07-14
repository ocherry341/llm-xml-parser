export function set(object: any, path: (number | string)[], value: any) {
  if (!isObject(object)) {
    return object;
  }

  let index = -1,
    length = path.length,
    lastIndex = length - 1,
    nested = object;

  while (nested != null && ++index < length) {
    let key = path[index],
      newValue = value;

    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return object;
    }

    if (index != lastIndex) {
      let objValue = nested[key];
      newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
    }
    nested[key] = newValue;
    nested = nested[key];
  }
  return object;
}

function isObject(value: any) {
  const type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

function isIndex(value: any) {
  var type = typeof value;

  return (
    (type == 'number' || (type != 'symbol' && /^(?:0|[1-9]\d*)$/.test(value))) &&
    value > -1 &&
    value % 1 == 0
  );
}