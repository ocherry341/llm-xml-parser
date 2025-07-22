import { Parser } from 'htmlparser2';
import { splitChunk, STATE } from './utils/split-chunk.js';

export interface XMLTokenOutput {
  path: (string | number)[];
  token: string;
  state: 'tag_open' | 'tag_close' | 'message_open' | 'message_close' | 'data_close';
  tagStack: string[];
}

export interface XMLTokenStreamOptions {
  /**
   * Determines if a tag is an array
   * @param tagName current tag name
   * @param tagStack current tag stack
   * @returns true if the tag is an array, false otherwise
   */
  isArray?: undefined | ((tagName: string, tagStack: string[]) => boolean);
}

export class XMLTokenStream extends TransformStream<string, XMLTokenOutput> {
  private arrayIndexes: Map<string, number> = new Map();
  private messageIndex: number = 0;

  private tagStack: string[] = [];
  private prevTagStack: string[] = [];

  private closedTag: string = '';
  private closeMessage: boolean = false;
  private hasMessage: boolean = false;

  constructor(options: XMLTokenStreamOptions = {}) {
    const { isArray = () => false } = options;
    const ROOT_TAG = 'INTERNAL_ROOT';

    let count = 0;

    let buffer: string[] = [];
    const MAX_BUFFER_SIZE = 10;
    let shouldBuffering = false;

    let tagStart = 0;
    let tagEnd = 0;
    let shouldSeparate = false;

    const parser = new Parser(
      {
        onopentag: (name) => {
          if (name === ROOT_TAG) {
            return;
          }

          if (this.tagStack.length === 0 && this.hasMessage) {
            this.closeMessage = true;
          }

          this.copyStack();
          this.tagStack.push(name);

          tagEnd = parser.endIndex; // index of the '>'
          tagStart = parser.endIndex - name.length - 1; // index of the '<'
          shouldSeparate = true;

          const _isArray = isArray(name, this.tagStack);
          if (_isArray) {
            const key = this.tagStack.join('/');
            this.arrayIndexes.set(key, (this.arrayIndexes.get(key) ?? -1) + 1);
          }
        },
        onclosetag: (name) => {
          if (name === ROOT_TAG && this.hasMessage) {
            this.closeMessage = true;
            return;
          }

          if (this.tagStack[this.tagStack.length - 1] === name) {
            this.copyStack();
            this.tagStack.pop();
            tagEnd = parser.endIndex; // index of the '>'
            tagStart = parser.endIndex - name.length - 2; // index of the '<'
            this.closedTag = name;
            shouldSeparate = true;
          }

          if (this.tagStack.length === 0 && this.hasMessage) {
            this.messageIndex++;
          }
        },
      },
      {
        xmlMode: true,
        decodeEntities: false,
        recognizeCDATA: false,
        recognizeSelfClosing: false,
      }
    );

    super({
      start: () => {
        const tag = `<${ROOT_TAG}>`;
        count += tag.length;
        parser.write(tag);
      },

      flush: (controller: TransformStreamDefaultController<XMLTokenOutput>) => {
        const tag = `</${ROOT_TAG}>`;
        count += tag.length;
        parser.write(tag);
        this.emitClose(controller);
        parser.end();
      },

      transform: (
        inputChunk: string,
        controller: TransformStreamDefaultController<XMLTokenOutput>
      ) => {
        const splitted = splitChunk(inputChunk);
        for (const { token, state } of splitted) {
          // buffering tokens if state is TAG_OPEN
          if (state === STATE.TAG_OPEN) {
            shouldBuffering = true;
          }
          if (state === STATE.TAG_CLOSE || buffer.length >= MAX_BUFFER_SIZE) {
            shouldBuffering = false;
          }
          if (shouldBuffering) {
            buffer.push(token);
            continue;
          }

          let chunkToWrite = '';
          if (buffer.length > 0) {
            chunkToWrite += buffer.join('');
            buffer = [];
          }
          chunkToWrite += token;

          // write to parser
          count += chunkToWrite.length;
          shouldSeparate = false;
          parser.write(chunkToWrite);

          this.emitClose(controller);

          // separate xml tag from current chunk
          if (shouldSeparate) {
            const prev = chunkToWrite.slice(0, chunkToWrite.length - count + tagStart);
            this.emitOpen(controller, prev, true);
            chunkToWrite = chunkToWrite.slice(
              chunkToWrite.length + tagEnd - count + 1,
              chunkToWrite.length
            );
          }

          this.emitOpen(controller, chunkToWrite, false);
        }
      },
    });
  }

  private emitOpen(
    controller: TransformStreamDefaultController<XMLTokenOutput>,
    chunk: string,
    prev: boolean = false
  ) {
    if (!chunk) {
      return;
    }
    const path = this.getPath(prev);
    const state = this.tagStack.length > 0 ? 'tag_open' : 'message_open';
    if (state === 'message_open') {
      this.hasMessage = true;
    }
    controller.enqueue({
      state: state,
      token: chunk,
      path: this.tagStack.length > 0 ? path : [this.messageIndex],
      tagStack: prev ? [...this.prevTagStack] : [...this.tagStack],
    });
  }

  private emitClose(controller: TransformStreamDefaultController<XMLTokenOutput>) {
    if (this.closedTag) {
      controller.enqueue({
        state: 'tag_close',
        token: '',
        path: [...this.getPath(), this.closedTag],
        tagStack: [...this.prevTagStack],
      });
      this.closedTag = '';
      if (this.tagStack.length === 0) {
        controller.enqueue({
          state: 'data_close',
          token: '',
          path: [...this.getPath(), this.closedTag],
          tagStack: [...this.prevTagStack],
        });
      }
    }
    if (this.closeMessage) {
      controller.enqueue({
        state: 'message_close',
        token: '',
        path: [this.messageIndex],
        tagStack: [],
      });
      this.closeMessage = false;
      this.hasMessage = false;
    }
  }

  private getPath(prev = false) {
    const stack = prev ? this.prevTagStack : this.tagStack;

    const result: (string | number)[] = [];
    for (const tag of stack) {
      result.push(tag);
      const key = result.join('/');
      if (this.arrayIndexes.has(key)) {
        result.push(this.arrayIndexes.get(key)!);
      }
    }

    return result;
  }

  private copyStack() {
    this.prevTagStack = [...this.tagStack];
  }
}
