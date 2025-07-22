import type { Stream } from '@anthropic-ai/sdk/core/streaming.mjs';

export function fromAnthropic<T>(
  stream: Stream<T>,
  options: { get: (item: T) => string | null | undefined }
): ReadableStream<string> {
  const { get } = options;

  return new ReadableStream<string>({
    pull: async (controller) => {
      for await (const chunk of stream) {
        const text = get(chunk);
        if (text) {
          controller.enqueue(text);
        }
      }
      controller.close();
    },
  });
}