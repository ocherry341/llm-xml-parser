import { describe, expect, it } from 'vitest';
import { fromSSE } from './from-SSE.js';
import sse from '../../fixtures/sse.txt?raw';

function mockSSE() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of sse.split('\n')) {
        controller.enqueue(new TextEncoder().encode(chunk + '\n'));
      }
      controller.close();
    },
  });
}

describe('from-sse', () => {
  it('should transform SSE data to text stream', async () => {
    const stream = fromSSE(mockSSE());
    for await (const text of stream) {
      expect(text).toBe('Hello World!');
    }
  });
});
