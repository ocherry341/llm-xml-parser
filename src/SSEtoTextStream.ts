export class SSEtoTextStream extends TransformStream<Uint8Array, string> {
  constructor() {
    let buffer = '';
    const decoder = new TextDecoder();

    super({
      transform(chunk: Uint8Array, controller: TransformStreamDefaultController<string>) {
        buffer += decoder.decode(chunk, { stream: true });

        while (true) {
          const separatorIndex = buffer.indexOf('\n\n');
          if (separatorIndex === -1) {
            break;
          }

          const messageBlock = buffer.slice(0, separatorIndex);

          buffer = buffer.slice(separatorIndex + 2);

          const lines = messageBlock.split('\n');
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data) {
                controller.enqueue(data);
              }
            }
          }
        }
      },

      flush(controller: TransformStreamDefaultController<string>) {
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
      },
    });
  }
}
