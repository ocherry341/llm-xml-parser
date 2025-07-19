import { describe, expect, it } from 'vitest';
import { splitChunk } from './split-chunk.js';

describe('splitChunk', () => {
  describe('should split chunk by XML tags', () => {
    it('case 1', () => {
      const str = '<root><tag>content</tag></root>';
      expect(splitChunk(str)).toEqual([
        { token: '<root>', state: 2 },
        { token: '<tag>', state: 2 },
        { token: 'content', state: 2 },
        { token: '</tag>', state: 2 },
        { token: '</root>', state: 2 },
      ]);
    });

    it('case 2', () => {
      const str = 'root><tag>content</tag></root';
      expect(splitChunk(str)).toEqual([
        { token: 'root>', state: 2 },
        { token: '<tag>', state: 2 },
        { token: 'content', state: 2 },
        { token: '</tag>', state: 2 },
        { token: '</root', state: 1 },
      ]);
    });

    it('case 3', () => {
      const str = 'content<tag';
      expect(splitChunk(str)).toEqual([
        { token: 'content', state: 0 },
        { token: '<tag', state: 1 },
      ]);
    });

    it('case 4', () => {
      const str = 'content<tag>content</tag><open_';
      expect(splitChunk(str)).toEqual([
        { token: 'content', state: 0 },
        { token: '<tag>', state: 2 },
        { token: 'content', state: 2 },
        { token: '</tag>', state: 2 },
        { token: '<open_', state: 1 },
      ]);
    });

    it('case 5', () => {
      const str = '<tag_open';
      expect(splitChunk(str)).toEqual([{ token: '<tag_open', state: 1 }]);
    });

    it('case 6', () => {
      const str = 'some text with no tags';
      expect(splitChunk(str)).toEqual([{ token: 'some text with no tags', state: 0 }]);
    });
  });
});
