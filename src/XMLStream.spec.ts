import { describe, expect, it } from 'vitest';
import { XMLStream } from './XMLStream.js';
import { mockTextStream } from '../test/mock.js';
import xml from '../test/fixtures/llm-output.txt?raw';
import path from 'path';
import fs from 'fs';

describe('XMLStream', () => {
  it('should parse XML messages correctly', async () => {
    const parser = new XMLStream({ isArray: (tagName) => tagName === 'option' });
    const stream = mockTextStream(xml).pipeThrough(parser);

    const out = path.resolve('tmp/xml-stream.txt');
    fs.writeFileSync(out, '');

    for await (const chunk of stream) {
      expect(Array.isArray(chunk.messages)).toBe(true);
      expect(chunk.data).toBeDefined();
      expect(chunk.state).toBeOneOf(['tag_open', 'tag_close', 'message_open', 'message_close', 'data_close']);
      expect(chunk.last).toBeDefined();
      fs.appendFileSync(out, JSON.stringify(chunk) + '\n');
    }
  });
});
