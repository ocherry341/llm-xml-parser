import { describe, expect, it } from 'vitest';
import xml from '../fixtures/xml-stream.txt?raw';
import { XMLStream } from './XMLStream';

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
    const stream = mockXMLStream().pipeThrough(new XMLStream());
    for await (const chunk of stream) {
      expect(Array.isArray(chunk.paths)).toBe(true);
      expect(chunk.text.includes('<') || chunk.text.includes('>')).toBe(false);
    }
  });
});
