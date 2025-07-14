export function get(object: any, path: (number | string)[]) {
  let index = 0;
  const length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return index && index == length ? object : undefined;
}
