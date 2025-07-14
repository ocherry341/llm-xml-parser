import { describe, expect, it, beforeEach } from 'vitest';
import xml from '../fixtures/xml-stream.txt?raw';
import { XMLStream } from './XMLStream.js';

function mockXMLStream() {
  const chunks = xml.split('\n');

  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe('XMLStream', () => {
  describe('token mode', () => {
    it('should parse XML messages correctly', async () => {
      const parser = new XMLStream({ mode: 'chunk' });
      const stream = mockXMLStream().pipeThrough(parser);
      for await (const chunk of stream) {
        if (chunk.state !== 'chunk') {
          throw new Error('Expected state to be "chunk"');
        }
        expect(Array.isArray(chunk.path)).toBe(true);
        expect(chunk.chunk.includes('<') || chunk.chunk.includes('>')).toBe(false);
      }
    });
  });

  describe('partial mode', () => {
    it('should parse XML messages correctly', async () => {
      const parser = new XMLStream({ mode: 'partial' });
      const stream = mockXMLStream().pipeThrough(parser);
      for await (const chunk of stream) {
        if (chunk.state === 'chunk') {
          throw new Error('Expected state to be "partial" or "complete"');
        }
        expect(chunk.state).toBeOneOf(['partial', 'complete']);
        expect(chunk.tagStack).toBeDefined();
        expect(chunk.lastTag).toBeDefined();
        // TODO check data
        expect(chunk.data).toBeDefined();
        // console.log(JSON.stringify(chunk, null, 2));
      }
    });
  });

  describe('complete mode', () => {
    it('should parse XML messages correctly', async () => {
      const parser = new XMLStream({ mode: 'complete' });
      const stream = mockXMLStream().pipeThrough(parser);
      for await (const chunk of stream) {
        if (chunk.state === 'chunk') {
          throw new Error('Expected state to be "complete"');
        }
        expect(chunk.state).toBe('complete');
        expect(chunk.tagStack).toBeDefined();
        expect(chunk.lastTag).toBeDefined();
        // TODO check data
        expect(chunk.data).toBeDefined();
        console.log(JSON.stringify(chunk, null, 2));
      }
    });
  });

  describe('getPath', () => {
    it('should return paths with array indexes', () => {
      const parser = new XMLStream();
      const tagStack = ['foo', 'bar', 'baz'];
      const arrayIndexes = new Map<string, number>([['foo/bar', 1]]);
      const path = (parser as any).getPath(tagStack, arrayIndexes);
      expect(path).toEqual(['foo', 'bar', 1, 'baz']);
    });

    it('should return paths without array indexes', () => {
      const parser = new XMLStream();
      const tagStack = ['foo', 'bar', 'baz'];
      const arrayIndexes = new Map<string, number>();
      const path = (parser as any).getPath(tagStack, arrayIndexes);
      expect(path).toEqual(['foo', 'bar', 'baz']);
    });
  });

  describe('splitChunk', () => {
    let splitChunk: (str: string) => { token: string; state: number }[];
    beforeEach(() => {
      const parser = new XMLStream();
      splitChunk = (parser as any).splitChunk.bind(parser);
    });

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
        expect(splitChunk(str)).toEqual([
          { token: '<tag_open', state: 1 },
        ]);
      });

      it('case 6', () => {
        const str = 'some text with no tags'
        expect(splitChunk(str)).toEqual([
          { token: 'some text with no tags', state: 0 }
        ]);
      });
    });
  });
});
