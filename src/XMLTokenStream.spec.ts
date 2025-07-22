import { describe, expect, it } from 'vitest';
import { XMLTokenStream } from './XMLTokenStream.js';
import path from 'path';
import fs from 'fs';
import { mockTextStream } from '../test/mock.js';
import xml from '../test/fixtures/llm-output.txt?raw';

describe('XMLTokenStream', () => {
  it('should parse XML messages correctly', async () => {
    const parser = new XMLTokenStream({
      isArray: (tagName) => tagName === 'option',
    });
    const stream = mockTextStream(xml).pipeThrough(parser);

    const out = path.resolve('tmp/xml-token-stream.txt');
    fs.writeFileSync(out, '');

    for await (const chunk of stream) {
      expect(Array.isArray(chunk.path)).toBe(true);
      expect(chunk.token.includes('<') || chunk.token.includes('>')).toBe(false);
      fs.appendFileSync(out, JSON.stringify(chunk) + '\n');
    }
  });
});
