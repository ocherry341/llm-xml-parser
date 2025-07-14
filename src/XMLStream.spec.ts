import { describe, expect, it } from 'vitest';
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
        console.log(chunk.data);
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
        console.log(chunk.data);
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
});
