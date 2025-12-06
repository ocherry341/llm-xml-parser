import { describe, expect, it } from 'vitest';
import { XMLTokenStream } from './XMLTokenStream.js';
import { mockTextStream } from '../test/mock.js';
import xml from '../test/fixtures/llm-output.txt?raw';

describe('XMLTokenStream', () => {
  it('should parse XML messages correctly', async () => {
    const parser = new XMLTokenStream({
      isArray: (tagName) => tagName === 'option',
    });
    const stream = mockTextStream(xml).pipeThrough(parser);

    const events: any[] = [];

    for await (const chunk of stream) {
      events.push(chunk);
    }

    expect(events).toMatchSnapshot();
  });
});
