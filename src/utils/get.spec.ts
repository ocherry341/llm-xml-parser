import { describe, expect, it } from 'vitest';
import { get } from './get.js';

describe('get', () => {
  it('should return undefined for empty path', () => {
    const object = { a: 1, b: { c: 2 } };
    const result = get(object, []);
    expect(result).toBeUndefined();
  });

  it('should return undefined for invalid path', () => {
    const object = { a: 1, b: { c: 2 } };
    const result = get(object, ['b', 'd', 'e', 'f']);
    expect(result).toBeUndefined();
  });

  it('should return value for valid path', () => {
    const object = { a: 1, b: { c: 2 } };
    const result = get(object, ['b', 'c']);
    expect(result).toBe(2);
  });

  it('should return value for array path', () => {
    const object = { a: 1, b: { c: [2, 3, 4] } };
    const result = get(object, ['b', 'c', 1]);
    expect(result).toBe(3);
  });

  it('should return value for nested path', () => {
    const object = {
      a: 1,
      b: {
        c: [
          {
            d: 2,
            e: [3, 4],
          },
          {
            d: 5,
            e: [
              { key: 'k1', value: 6 },
              { key: 'k2', value: 7 },
            ],
          },
        ],
      },
    };

    expect(get(object, ['a'])).toBe(1);
    expect(get(object, ['b', 'c', 0, 'e', 1])).toBe(4);
    expect(get(object, ['b', 'c', 0, 'e', 0, 'value'])).toBeUndefined();
    expect(get(object, ['b', 'c', 1, 'e', 0, 'value'])).toBe(6);
  });
});
