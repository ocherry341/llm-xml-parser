import { append } from './utils/append.js';
import { XMLTokenStream, type XMLTokenOutput } from './XMLTokenStream.js';

export interface XMLOutput {
  state: 'tag_open' | 'tag_close' | 'message_open' | 'message_close';
  data: any;
  messages: string[];
  tagStack: string[];
  last: string | number;
}

class XMLAssignStream extends TransformStream<XMLTokenOutput, XMLOutput> {
  public data: any = {};
  public messages: string[] = [];

  constructor() {
    super({
      transform: (
        chunk: XMLTokenOutput,
        controller: TransformStreamDefaultController<XMLOutput>
      ) => {
        const { path, state, token } = chunk;
        // append data or messages based on the state
        if (state === 'tag_open' || state === 'tag_close') {
          append(this.data, path, token);
        }

        if (state === 'message_open' || state === 'message_close') {
          const msgIndex = path[0] as number;
          this.messages[msgIndex] = (this.messages[msgIndex] || '') + token;
        }

        const last = state.startsWith('tag_')
          ? chunk.tagStack[chunk.tagStack.length - 1]
          : chunk.path[0];

        controller.enqueue({
          state,
          data: structuredClone(this.data),
          messages: [...this.messages],
          tagStack: chunk.tagStack,
          last: last,
        });
      },
    });
  }
}

export class XMLStream {
  public readonly readable: ReadableStream<XMLOutput>;
  public readonly writable: WritableStream<string>;

  public data: any = {};
  public messages: string[] = [];

  constructor() {
    const tokenStream = new XMLTokenStream();
    const assignStream = new XMLAssignStream();

    this.readable = tokenStream.readable.pipeThrough(assignStream);
    this.writable = tokenStream.writable;
    this.data = assignStream.data;
    this.messages = assignStream.messages;
  }
}
