import { get } from './get.js';
import { set } from './set.js';

export function append(object: any, path: (number | string)[], value: string) {
  const v = get(object, path) || '';
  return set(object, path, v + value);
}
