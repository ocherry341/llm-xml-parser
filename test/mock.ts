const MIN_LENGTH = 5;
const MAX_LENGTH = 10;

function createLengthGenerator(seed: number, min: number, max: number) {
  let state = seed >>> 0;

  const nextRandom = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };

  return function nextLength() {
    const r = nextRandom();
    return Math.floor(r * (max - min + 1)) + min;
  };
}

function breakString(str: string): string[] {
  const nextLength = createLengthGenerator(42, MIN_LENGTH, MAX_LENGTH);

  const parts: string[] = [];
  let currentIndex = 0;

  while (currentIndex < str.length) {
    const partLength = nextLength();
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
