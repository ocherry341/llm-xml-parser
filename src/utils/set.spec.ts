import { describe, expect, it } from 'vitest';
import { set } from './set.js';

describe('set', () => {
  it('should set value at the specified path', () => {
    const object = { foo: 'bar' };
    const path = ['a', 'b', 'c'];
    const value = 42;

    const result = set(object, path, value);
    expect(result).toEqual({ a: { b: { c: 42 } }, foo: 'bar' });
  });

  it('should overwrite existing value at the specified path', () => {
    const object = { a: { b: { c: 10 } } };
    const path = ['a', 'b', 'c'];
    const value = 20;

    const result = set(object, path, value);
    expect(result).toEqual({ a: { b: { c: 20 } } });
  });

  it('should set value in an array at the specified path', () => {
    const object = { foo: ['bar', 'baz'] };
    const path = ['foo', 2];
    const value = 'qux';
    const result = set(object, path, value);
    expect(result).toEqual({ foo: ['bar', 'baz', 'qux'] });
  });

  it('should set value in an array with undefined elements', () => {
    const object = { foo: ['bar', 'baz'] };
    const path = ['a', 'b', 2];
    const value = 'qux';
    const result = set(object, path, value);
    expect(result).toEqual({ a: { b: [undefined, undefined, 'qux'] }, foo: ['bar', 'baz'] });
  });

  it('should set value with deeply nested path', () => {
    const object = {};
    set(object, ['a', 'b', 'c', 1, 'd', 2, 'e', 0], 3);
    expect(object).toEqual({
      a: { b: { c: [undefined, { d: [undefined, undefined, { e: [3] }] }] } },
    });
  });
});
