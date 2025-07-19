import { describe, expect, it } from 'vitest';
import { fromSSE } from './from-SSE.js';
import xml from '../../test/fixtures/llm-output.xml?raw';
import { mockSSE } from '../../test/mock.js';

describe('from-sse', () => {
  it('should transform SSE data to text stream', async () => {
    const sse = mockSSE(xml);
    const stream = fromSSE(sse);
    for await (const text of stream) {
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      expect(text.includes('data:')).toBe(false);
    }
  });

  it('should transform SSE data with custom get function', async () => {
    const sse = mockSSE(xml);
    const stream = fromSSE(sse, {
      get: (event) => JSON.stringify(event),
    });

    for await (const text of stream) {
      expect(typeof text).toBe('string');
      const parsed = JSON.parse(text);
      expect(parsed.data).toBeDefined();
      expect(parsed.id).toBeDefined();
      expect(parsed.event).toBeDefined();
    }
  });
});
