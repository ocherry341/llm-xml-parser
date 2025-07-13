import type { Stream } from 'openai/core/streaming.mjs';

interface Options<T> {
  /**
   * Extracts the text content from an OpenAI stream chunk.
   * @example
   * const options = {
   *  get: (item) => item.choices[0]?.delta?.content
   * }
   */
  get: (item: T) => string | null | undefined;
}

/**
 * Converts an OpenAI streaming response into a text readable stream.
 * @example
 * const textStream = fromOpenAI(openaiStream, {
 *   get: (item) => item.choices[0]?.delta?.content,
 * });
 */
export function fromOpenAI<T>(stream: Stream<T>, options: Options<T>): ReadableStream<string> {
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
