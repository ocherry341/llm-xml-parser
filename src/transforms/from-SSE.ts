interface Event {
  data: string;
  id?: string;
  event?: string;
  retry?: number;
}

interface Options {
  /**
   * Extracts the text content from an OpenAI stream chunk.
   * @example
   * const options = {
   *  get: (event) => JSON.parse(event.data).text
   * }
   */
  get?: (event: Event) => string;
}

export function fromSSE(
  stream: ReadableStream<Uint8Array<ArrayBufferLike>>,
  options: Options = {}
): ReadableStream<string> {
  const { get = (e) => e.data } = options;

  let buffer = '';
  const decoder = new TextDecoder();

  const readable = new ReadableStream<string>({
    pull: async (controller) => {
      for await (const chunk of stream) {
        buffer += decoder.decode(chunk, { stream: true });

        while (true) {
          const separatorIndex = buffer.indexOf('\n\n');
          if (separatorIndex === -1) {
            break;
          }

          const messageBlock = buffer.slice(0, separatorIndex);

          buffer = buffer.slice(separatorIndex + 2);

          const lines = messageBlock.split('\n');
          const event = { data: '' } as Event;
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              event.data += data;
              continue;
            }

            if (line.startsWith('id:')) {
              event.id = line.slice(3).trim();
              continue;
            }

            if (line.startsWith('event:')) {
              event.event = line.slice(6).trim();
              continue;
            }

            if (line.startsWith('retry:')) {
              const retryValue = parseInt(line.slice(6).trim(), 10);
              if (!isNaN(retryValue)) {
                event.retry = retryValue;
              }
              continue;
            }
          }

          const data = get(event);
          controller.enqueue(data);
        }
      }

      const remaining = decoder.decode();
      if (remaining) {
        buffer += remaining;
      }

      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              controller.enqueue(data);
            }
          }
        }
      }

      controller.close();
    },
  });

  return readable;
}
