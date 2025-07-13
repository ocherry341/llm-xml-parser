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
  it('should parse XML messages correctly', async () => {
    const parser = new XMLStream();
    const stream = mockXMLStream().pipeThrough(parser);
    for await (const chunk of stream) {
      expect(Array.isArray(chunk.path)).toBe(true);
      expect(chunk.text.includes('<') || chunk.text.includes('>')).toBe(false);
    }
  });

  describe('getPath', () => {
    it('should return paths with array indexes', () => {
      const parser = new XMLStream();
      const tagStack = ['ROOT', 'foo', 'bar', 'baz'];
      const arrayIndexes = new Map<string, number>([['ROOT/foo/bar', 1]]);
      const path = (parser as any).getPath(tagStack, arrayIndexes);
      expect(path).toEqual(['foo', 'bar', 1, 'baz']);
    });

    it('should return paths without array indexes', () => {
      const parser = new XMLStream();
      const tagStack = ['ROOT', 'foo', 'bar', 'baz'];
      const arrayIndexes = new Map<string, number>();
      const path = (parser as any).getPath(tagStack, arrayIndexes);
      expect(path).toEqual(['foo', 'bar', 'baz']);
    });
  });
});
