import type { GenerateContentResponse, StreamGenerateContentResult } from '@google-cloud/vertexai';

export function formVertexAI(
  stream: StreamGenerateContentResult,
  options: { get: (item: GenerateContentResponse) => string | null | undefined }
): ReadableStream<string> {
  const { get } = options;

  return new ReadableStream<string>({
    pull: async (controller) => {
      for await (const chunk of stream.stream) {
        const text = get(chunk);
        if (text) {
          controller.enqueue(text);
        }
      }
      controller.close();
    },
  });
}
