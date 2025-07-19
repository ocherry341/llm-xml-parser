const MIN_LENGTH = 5;
const MAX_LENGTH = 10;

function random() {
  return Math.floor(Math.random() * (MAX_LENGTH - MIN_LENGTH + 1)) + MIN_LENGTH;
}

function breakString(str: string): string[] {
  const parts: string[] = [];
  let currentIndex = 0;

  while (currentIndex < str.length) {
    const partLength = random();
    const part = str.slice(currentIndex, currentIndex + partLength);
    parts.push(part);
    currentIndex += partLength;
  }

  return parts;
}

export function mockTextStream(text: string): ReadableStream<string> {
  const array = breakString(text);
  return new ReadableStream({
    start(controller) {
      for (const part of array) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

export function mockSSE(text: string): ReadableStream<Uint8Array> {
  const array = breakString(text);
  let id = 0;
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const part of array) {
        controller.enqueue(encoder.encode(`id: ${id++}\n`));
        controller.enqueue(encoder.encode(`event: message\n`));
        controller.enqueue(encoder.encode(`data: ${part}\n\n`));
      }
      controller.close();
    },
  });
}
