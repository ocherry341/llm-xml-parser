import { describe, expect, it } from 'vitest';
import xml from '../fixtures/xml-stream.txt?raw';
import { XMLTokenStream } from './XMLTokenStream.js';
import path from 'path';
import fs from 'fs';

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

describe('XMLTokenStream', () => {
  it('should parse XML messages correctly', async () => {
    const parser = new XMLTokenStream();
    const stream = mockXMLStream().pipeThrough(parser);

    const out = path.resolve('tmp/xml-token-stream.txt');
    fs.writeFileSync(out, '');

    for await (const chunk of stream) {
      expect(Array.isArray(chunk.path)).toBe(true);
      expect(chunk.token.includes('<') || chunk.token.includes('>')).toBe(false);
      fs.appendFileSync(out, JSON.stringify(chunk) + '\n');
    }
  });
});
