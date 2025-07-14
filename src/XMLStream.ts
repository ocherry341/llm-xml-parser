import { Parser } from 'htmlparser2';
import { append } from './utils/append.js';

interface XMLChunkOutput {
  state: 'chunk';
  path: (string | number)[];
  chunk: string;
}

interface XMLDataOutput {
  state: 'partial' | 'complete';
  data: any;
  lastTag: string;
  tagStack: string[];
}

type XMLOutput = XMLChunkOutput | XMLDataOutput;

const STATE = {
  UNKNOWN: 0,
  TAG_OPEN: 1,
  TAG_CLOSE: 2,
};

export interface XMLStreamOptions {
  messageKey?: string;
  mode?: 'chunk' | 'partial' | 'complete';
  /**
   * Determines if a tag is an array
   * @param tagName current tag name
   * @param tagStack current tag stack
   * @returns true if the tag is an array, false otherwise
   */
  isArray?: (tagName: string, tagStack: string[]) => boolean;
}

const DEFAULT_MESSAGE_KEY = 'messages';
const DEFAULT_MODE = 'chunk' as const;

export class XMLStream extends TransformStream<string, XMLOutput> {
  public data: any = {};

  private arrayIndexes: Map<string, number> = new Map();

  private tagStack: string[] = [];
  private prevTagStack: string[] = [];

  private closedTag: string = '';

  constructor(private options: XMLStreamOptions = {}) {
    const { isArray = () => false, messageKey = DEFAULT_MESSAGE_KEY } = options;
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

          if (this.tagStack.length === 0) {
            this.closedTag = messageKey;
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
          if (name === ROOT_TAG) {
            return;
          }

          if (this.tagStack[this.tagStack.length - 1] === name) {
            this.copyStack();
            this.tagStack.pop();
            tagEnd = parser.endIndex; // index of the '>'
            tagStart = parser.endIndex - name.length - 2; // index of the '<'
            shouldSeparate = true;
            this.closedTag = name;
          }

          if (this.tagStack.length === 0) {
            this.arrayIndexes.set(messageKey, this.arrayIndexes.get(messageKey)! + 1);
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

      flush: (controller: TransformStreamDefaultController<XMLOutput>) => {
        const tag = `</${ROOT_TAG}>`;
        count += tag.length;
        parser.write(tag);
        this.emitComplete(controller);
        parser.end();
      },

      transform: (inputChunk: string, controller: TransformStreamDefaultController<XMLOutput>) => {
        const splitted = this.splitChunk(inputChunk);
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

          this.emitComplete(controller);

          // separate xml tag from current chunk
          if (shouldSeparate) {
            const prev = chunkToWrite.slice(0, chunkToWrite.length - count + tagStart);
            this.emit(controller, prev, true);
            chunkToWrite = chunkToWrite.slice(
              chunkToWrite.length + tagEnd - count + 1,
              chunkToWrite.length
            );
          }

          this.emit(controller, chunkToWrite, false);
        }
      },
    });

    this.arrayIndexes.set(messageKey, 0);
  }

  private emit(
    controller: TransformStreamDefaultController<XMLOutput>,
    chunk: string,
    prev: boolean = false
  ) {
    if (!chunk) {
      return;
    }
    const { mode = DEFAULT_MODE, messageKey = DEFAULT_MESSAGE_KEY } = this.options;
    const stack = prev ? this.prevTagStack : this.tagStack;
    const path = this.getPath(stack, this.arrayIndexes, messageKey);
    if (mode === 'chunk') {
      controller.enqueue({
        state: 'chunk',
        chunk: chunk,
        path: path,
      });
    } else {
      append(this.data, path, chunk);
      if (mode === 'partial') {
        controller.enqueue({
          state: 'partial',
          data: structuredClone(this.data),
          lastTag: stack[stack.length - 1] || messageKey,
          tagStack: [...stack],
        });
      }
    }
  }

  private emitComplete(controller: TransformStreamDefaultController<XMLOutput>) {
    const { mode = DEFAULT_MODE } = this.options;

    if (this.closedTag && mode !== 'chunk') {
      controller.enqueue({
        state: 'complete',
        data: structuredClone(this.data),
        lastTag: this.closedTag,
        tagStack: [...this.tagStack, this.closedTag],
      });
    }

    this.closedTag = '';
  }

  private getPath(tagStack: string[], arrayIndexes: Map<string, number>, messageKey: string) {
    const result: (string | number)[] = [];
    for (const tag of tagStack) {
      result.push(tag);
      const key = result.join('/');
      if (arrayIndexes.has(key)) {
        result.push(arrayIndexes.get(key)!);
      }
    }

    if (result.length === 0) {
      return [messageKey, arrayIndexes.get(messageKey)!];
    } else {
      return result;
    }
  }

  // splits the input string with XML tags boundaries
  private splitChunk(str: string) {
    const result = [] as { token: string; state: number }[];

    let current = '';
    let state = STATE.UNKNOWN;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (char === '<') {
        if (current.trim()) {
          result.push({ token: current, state });
        }
        current = '<';
        state = STATE.TAG_OPEN;
      } else if (char === '>') {
        state = STATE.TAG_CLOSE;
        current += '>';
        result.push({ token: current, state });
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      result.push({ token: current, state });
    }

    const filteredResult = result.filter((item) => item.token.trim().length > 0);
    return filteredResult;
  }

  private copyStack() {
    this.prevTagStack = [...this.tagStack];
  }
}
